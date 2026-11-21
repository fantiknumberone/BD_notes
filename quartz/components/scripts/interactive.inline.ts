// Quartz 4, client-side only. SQL runs in a disposable Web Worker.
// Marker content remains ordinary fenced Markdown in the vault.
const ALASQL_CDN = "https://cdn.jsdelivr.net/npm/alasql@4.6.5/dist/alasql.min.js"
const SORTABLE_CDN = "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"

type BlockKind = "setup" | "run" | "quiz" | "order" | "task"
type Block = { kind: BlockKind; lines: string[]; pre: HTMLPreElement; source: string }
type Reply = { id: number; ok: boolean; error?: string; [key: string]: any }
type SortableObject = { destroy: () => void }
type SortableConstructor = new (el: HTMLElement, options: object) => SortableObject

function esc(value: unknown): string {
  return String(value ?? "NULL").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!)
}

// Self-contained: its source is copied into a Blob Worker after transpilation.
function sqlWorkerRuntime(libraryUrl: string) {
  const ctx = self as any
  let a: any
  let bootError = ""
  try {
    ctx.importScripts(libraryUrl)
    a = ctx.alasql
    if (!a) throw new Error("AlaSQL не загрузился")
    a.options.cache = false
  } catch (e) {
    bootError = e instanceof Error ? e.message : String(e)
  }

  // Setup is trusted course SQL; learner SQL is limited to local relational operations.
  function reset(setup: string) {
    a.tables = {}
    a.databases.alasql.tables = a.tables
    a.use("alasql")
    a(setup)
  }
  function validate(sql: string, readOnly: boolean) {
    if (!sql.trim()) throw new Error("Введите SQL-запрос")
    if (sql.length > 20000) throw new Error("Запрос слишком длинный для учебной песочницы")
    // Strip literals, quoted identifiers and comments before checking executable syntax.
    const plain = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\//g, " ")
    if (/[`{}@$\[\]]|->/.test(plain)) throw new Error("Используйте обычный SQL без встроенного JavaScript")
    if (/\b(?:JAVASCRIPT|FUNCTION|REQUIRE|ATTACH|DETACH|DATABASE|DATABASES|USE|IMPORT|EXPORT|SOURCE|ASSERT|ECHO|PRINT)\b/i.test(plain)) {
      throw new Error("Здесь доступны локальные запросы и изменения учебных таблиц без внешнего ввода/вывода")
    }
    const functions = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "ROUND", "ABS", "CEIL", "FLOOR", "LOWER", "UPPER", "LEN", "LENGTH", "TRIM", "SUBSTRING", "SUBSTR", "CONCAT", "IIF", "IFNULL", "CAST", "CONVERT", "INT", "INTEGER", "VARCHAR", "CHAR", "DECIMAL", "NUMERIC", "NUMBER", "STRING", "IN", "EXISTS", "VALUES", "AS", "OVER", "PARTITION", "GROUP", "BY", "FROM", "SELECT", "WHERE", "ON", "AND", "OR", "NOT", "THEN", "ELSE", "WHEN"])
    for (const match of plain.matchAll(/\b([A-Za-z_][\w]*)\s*\(/g)) {
      if (!functions.has(match[1].toUpperCase()) && !/(?:CREATE\s+TABLE|INSERT\s+INTO)\s*$/i.test(plain.slice(0, match.index))) {
        throw new Error("Эта функция не входит в учебный SQL-набор: " + match[1])
      }
    }
    const tree = a.parse(sql)
    if (!tree.statements?.length) throw new Error("Не найдена SQL-команда")
    if (readOnly && (tree.statements.length !== 1 || !(tree.statements[0] instanceof a.yy.Select))) {
      throw new Error("В задании нужен один SELECT без изменения данных")
    }
    if (readOnly && tree.statements[0].into) throw new Error("В задании нужен SELECT без INTO")
    if (!readOnly) {
      const allowed = [a.yy.Select, a.yy.Update, a.yy.Insert, a.yy.Delete, a.yy.CreateTable, a.yy.DropTable, a.yy.AlterTable].filter(Boolean)
      if (tree.statements.some((s: any) => !allowed.some((C: any) => s instanceof C))) {
        throw new Error("Эта команда не поддерживается учебной песочницей")
      }
    }
    return tree
  }
  function rows(result: any): Record<string, any>[] {
    if (!Array.isArray(result) || result.some(x => !x || typeof x !== "object" || Array.isArray(x))) {
      throw new Error("SELECT должен возвращать таблицу, без VALUE / MATRIX / COLUMN")
    }
    if (result.length > 2000) throw new Error("Результат больше 2000 строк: сузьте запрос")
    return result
  }
  function cellEqual(x: any, y: any): boolean {
    if (x == null && y == null) return true
    if (typeof x === "number" && typeof y === "number") {
      return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-8 * Math.max(1, Math.abs(x), Math.abs(y))
    }
    if (x instanceof Date || y instanceof Date) return String(x) === String(y)
    return typeof x === typeof y && JSON.stringify(x) === JSON.stringify(y)
  }
  function rowEqual(x: Record<string, any>, y: Record<string, any>) {
    const xv = Object.values(x), yv = Object.values(y)
    return xv.length === yv.length && xv.every((v, i) => cellEqual(v, yv[i]))
  }
  function same(actual: Record<string, any>[], expected: Record<string, any>[], ordered: boolean) {
    if (actual.length !== expected.length) return false
    if (ordered) return actual.every((r, i) => rowEqual(r, expected[i]))
    const used = new Set<number>()
    return actual.every(r => {
      const found = expected.findIndex((e, i) => !used.has(i) && rowEqual(r, e))
      if (found < 0) return false
      used.add(found)
      return true
    })
  }
  ctx.onmessage = (event: MessageEvent) => {
    const { id, kind, setup, sql, reference } = event.data
    let expected: Record<string, any>[] | undefined
    try {
      if (bootError) throw new Error("Не удалось загрузить AlaSQL с CDN: " + bootError)
      reset(setup || "")
      if (kind === "init") {
        ctx.postMessage({ id, ok: true, tables: Object.keys(a.tables) })
        return
      }
      if (kind === "task") {
        const tree = validate(reference, true)
        expected = rows(a(reference))
        const ordered = Boolean(tree.statements[0].order?.length)
        reset(setup || "")
        validate(sql, true)
        const actual = rows(a(sql))
        ctx.postMessage({ id, ok: true, actual, expected, ordered, correct: same(actual, expected, ordered) })
      } else {
        const tree = validate(sql, false)
        const result = a(sql)
        const results = tree.statements.length > 1 ? result : [result]
        for (const result of results) if (Array.isArray(result)) rows(result)
        ctx.postMessage({ id, ok: true, results })
      }
    } catch (e) {
      ctx.postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e), expected })
    }
  }
}

class SQLClient {
  private worker?: Worker
  private nextId = 0
  private pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  constructor(private setup: string) {}
  private start() {
    if (this.worker) return
    const source = "(" + sqlWorkerRuntime.toString() + ")(" + JSON.stringify(ALASQL_CDN) + ");"
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    this.worker = new Worker(url)
    URL.revokeObjectURL(url)
    this.worker.onmessage = (event: MessageEvent<Reply>) => {
      const p = this.pending.get(event.data.id)
      if (!p) return
      clearTimeout(p.timer)
      this.pending.delete(event.data.id)
      p.resolve(event.data)
    }
    this.worker.onerror = event => {
      event.preventDefault()
      this.close(new Error("Не удалось запустить SQL-песочницу. Проверьте доступ к CDN и настройки CSP сайта."))
    }
  }
  request(kind: string, sql = "", reference = ""): Promise<Reply> {
    this.start()
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(new Error("Превышено время выполнения. Упростите запрос или проверьте сеть и повторите.")), 15000)
      this.pending.set(id, { resolve, reject, timer })
      this.worker!.postMessage({ id, kind, setup: this.setup, sql, reference })
    })
  }
  close(error = new Error("Страница закрыта")) {
    this.worker?.terminate()
    this.worker = undefined
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error) }
    this.pending.clear()
  }
}

const libraryPromises = new Map<string, Promise<void>>()
function loadScript(url: string): Promise<void> {
  const cached = libraryPromises.get(url)
  if (cached) return cached
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = url
    script.async = true
    const timer = setTimeout(() => { script.remove(); libraryPromises.delete(url); reject(new Error("Загрузка библиотеки заняла слишком много времени")) }, 15000)
    script.onload = () => { clearTimeout(timer); resolve() }
    script.onerror = () => { clearTimeout(timer); script.remove(); libraryPromises.delete(url); reject(new Error("Библиотека не загрузилась с CDN")) }
    document.head.append(script)
  })
  libraryPromises.set(url, promise)
  return promise
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (text) el.textContent = text
  if (cls) el.className = cls
  return el
}
function button(text: string, action: () => void) {
  const el = element("button", text)
  el.type = "button"
  el.addEventListener("click", action)
  return el
}
function feedback(parent: HTMLElement, text: string, success: boolean) {
  parent.className = "iq-feedback " + (success ? "iq-success" : "iq-error")
  parent.textContent = text
}
function table(parent: HTMLElement, data: any) {
  if (!Array.isArray(data)) { parent.append(element("p", "Затронуто строк / результат команды: " + String(data))); return }
  if (!data.length) { parent.append(element("p", "Результат: 0 строк")); return }
  const keys = Object.keys(data[0])
  const wrapper = element("div", "", "iq-table-scroll")
  const t = element("table")
  t.innerHTML = "<thead><tr>" + keys.map(k => "<th>" + esc(k) + "</th>").join("") + "</tr></thead><tbody>" +
    data.slice(0, 100).map(row => "<tr>" + keys.map(k => "<td>" + esc(row[k]) + "</td>").join("") + "</tr>").join("") + "</tbody>"
  wrapper.append(t)
  parent.append(wrapper, element("p", "Строк: " + data.length + (data.length > 100 ? " (показаны первые 100)" : ""), "iq-muted"))
}
function parseBlocks(article: HTMLElement): Block[] {
  const result: Block[] = []
  article.querySelectorAll<HTMLPreElement>("pre").forEach(pre => {
    // Quartz syntax highlighting may put line-number spans next to the real code.
    const code = pre.querySelector("code")
    if (!code) return
    const source = (code.textContent || "").replace(/\r\n?/g, "\n").trim()
    const lines = source.split("\n")
    const first = lines.shift()?.trim()
    const kind: BlockKind | undefined = first === "-- setup" ? "setup" : first === "-- run" ? "run" : first === "#quiz" ? "quiz" : first === "#order" ? "order" : first === "#task" ? "task" : undefined
    if (kind) result.push({ kind, lines, pre, source })
  })
  return result
}
function shuffle<T>(input: T[]): T[] {
  const result = [...input]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]
  }
  if (result.length > 1 && result.every((v, i) => v === input[i])) result.push(result.shift()!)
  return result
}
let activeCleanup: (() => void) | undefined
let activeArticle: HTMLElement | undefined
let generation = 0

function initInteractive() {
  const article = document.querySelector<HTMLElement>("article")
  if (article && article === activeArticle && article.dataset.iqMounted === "true") return
  activeCleanup?.()
  const epoch = ++generation
  if (!article) return
  const blocks = parseBlocks(article)
  if (!blocks.length) return
  // popover previews clone article content; do not initialize those separately.
  if (article.dataset.iqMounted === "true") return
  article.dataset.iqMounted = "true"
  activeArticle = article
  const sortables: SortableObject[] = []
  const mounts: { pre: HTMLPreElement; section: HTMLElement }[] = []
  const sqlBlocks = blocks.filter(b => ["setup", "run", "task"].includes(b.kind))
  const setup = blocks.filter(b => b.kind === "setup").map(b => b.lines.join("\n")).join("\n")
  const client = sqlBlocks.length ? new SQLClient(setup) : undefined
  let disposed = false
  const alive = () => !disposed && generation === epoch && article.isConnected
  const controls: HTMLButtonElement[] = []
  const sqlOutputs: HTMLElement[] = []
  const exerciseBlocks = blocks.filter(b => ["quiz", "order", "task"].includes(b.kind))
  const keyFor = (block: Block) => {
    let hash = 2166136261
    for (const ch of block.source) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619)
    return "db-course:" + location.pathname + ":" + (hash >>> 0).toString(16)
  }
  const readSolved = (b: Block) => { try { return localStorage.getItem(keyFor(b)) === "solved" } catch { return false } }
  const progress = element("p", "", "iq-progress")
  const updateProgress = () => { progress.textContent = "🧩 Решено: " + exerciseBlocks.filter(readSolved).length + " / " + exerciseBlocks.length + ". Прогресс хранится только в этом браузере." }
  const markSolved = (b: Block) => { try { localStorage.setItem(keyFor(b), "solved") } catch { /* Storage can be disabled. Widgets still work. */ } updateProgress() }
  if (exerciseBlocks.length) { blocks[0].pre.before(progress); updateProgress() }

  function shell(b: Block, title: string) {
    const section = element("section", "", "iq-widget iq-" + b.kind)
    section.dataset.kind = b.kind
    section.append(element("h3", title))
    b.pre.replaceWith(section)
    mounts.push({ pre: b.pre, section })
    return section
  }
  for (const b of blocks) {
    if (b.kind === "setup") continue
    if (b.kind === "quiz") {
      const q = b.lines.find(line => /^\?\s*/.test(line))
      const options = b.lines.filter(line => /^[+-]\s*/.test(line)).map(line => ({ correct: line[0] === "+", text: line.slice(1).trim() }))
      const section = shell(b, "Выбери ответ")
      if (!q || options.filter(o => o.correct).length !== 1) { section.append(element("p", "Ошибка формата #quiz: нужен вопрос и один верный ответ.")); continue }
      section.append(element("p", q.replace(/^\?\s*/, "")))
      const answerButtons: { el: HTMLButtonElement; correct: boolean }[] = []
      const result = element("div", "", "iq-feedback")
      result.setAttribute("aria-live", "polite")
      for (const option of shuffle(options)) {
        const answer = button(option.text, () => {
          for (const item of answerButtons) {
            item.el.classList.toggle("iq-right-answer", item.correct)
            item.el.classList.toggle("iq-wrong-answer", item.el === answer && !option.correct)
          }
          feedback(result, option.correct ? "Верно!" : "Пока неверно. Правильный ответ выделен: " + options.find(o => o.correct)!.text, option.correct)
          if (option.correct) markSolved(b)
        })
        answer.className = "iq-option"
        answerButtons.push({ el: answer, correct: option.correct }); section.append(answer)
      }
      section.append(result)
    }
    if (b.kind === "order") {
      const correct = b.lines.map(s => s.trim()).filter(Boolean)
      const section = shell(b, "Восстанови порядок")
      if (!correct.length) { section.append(element("p", "Ошибка формата #order: нет шагов.")); continue }
      section.append(element("p", "Перетащи шаги за ручку ⋮⋮ или используй кнопки ↑ и ↓."))
      const list = element("ol", "", "iq-order-list")
      for (const entry of shuffle(correct.map((text, id) => ({ text, id })))) {
        const li = element("li")
        li.dataset.index = String(entry.id)
        li.append(element("span", "⋮⋮", "iq-handle"), element("span", entry.text, "iq-step"))
        const up = button("↑", () => { if (li.previousElementSibling) list.insertBefore(li, li.previousElementSibling) })
        const down = button("↓", () => { if (li.nextElementSibling) list.insertBefore(li.nextElementSibling, li) })
        up.setAttribute("aria-label", "Поднять шаг: " + entry.text); down.setAttribute("aria-label", "Опустить шаг: " + entry.text)
        li.append(up, down); list.append(li)
      }
      const result = element("div", "", "iq-feedback"); result.setAttribute("aria-live", "polite")
      section.append(list, button("Проверить порядок", () => {
        const ok = Array.from(list.children).every((li, i) => correct[Number((li as HTMLElement).dataset.index)] === correct[i])
        feedback(result, ok ? "Верно, порядок восстановлен!" : "Пока неверно. Правильный порядок:", ok)
        if (ok) markSolved(b)
        else { const ol = element("ol"); correct.forEach(text => ol.append(element("li", text))); result.append(ol) }
      }), result)
      loadScript(SORTABLE_CDN).then(() => {
        if (!alive()) return
        const Sortable = (window as unknown as { Sortable: SortableConstructor }).Sortable
        sortables.push(new Sortable(list, { animation: 150, handle: ".iq-handle", ghostClass: "iq-ghost" }))
      }).catch(() => { if (alive()) section.append(element("p", "Перетаскивание недоступно. Используйте кнопки ↑ и ↓.", "iq-muted")) })
    }
    if (b.kind === "run" || b.kind === "task") {
      const isTask = b.kind === "task"
      const section = shell(b, isTask ? "Напиши SQL-запрос" : "SQL-песочница")
      const answerAt = b.lines.findIndex(line => /^=\s*/.test(line))
      let reference = ""
      if (isTask) {
        if (answerAt < 0) { section.append(element("p", "Ошибка формата #task: отсутствует строка = эталонный SQL.")); continue }
        reference = b.lines[answerAt].replace(/^=\s*/, "")
        section.append(element("p", b.lines.slice(0, answerAt).join("\n"), "iq-task-description"))
      }
      const label = element("label", "Ваш SQL:")
      const input = element("textarea")
      input.rows = 6; input.spellcheck = false
      input.value = isTask ? "" : b.lines.join("\n")
      input.placeholder = "SELECT ..."
      label.append(input)
      const output = element("div", "", "iq-output"); output.setAttribute("aria-live", "polite")
      const showExpected = (reply: Reply) => {
        output.append(element("p", "Один из правильных запросов:"))
        const pre = element("pre"); pre.append(element("code", reference)); output.append(pre)
        if (reply.expected) { output.append(element("p", "Его результат:")); table(output, reply.expected) }
      }
      const execute = async () => {
        if (run.disabled || !client) return
        run.disabled = true; output.replaceChildren(element("p", "Выполняется…"))
        try {
          const reply = await client.request(isTask ? "task" : "run", input.value, reference)
          if (!alive()) return
          output.replaceChildren()
          if (!reply.ok) {
            const result = element("div"); feedback(result, "Ошибка SQL: " + reply.error, false); output.append(result)
            if (isTask) showExpected(reply)
          } else if (isTask) {
            const result = element("div"); feedback(result, reply.correct ? "Верно! Результат совпал с эталоном." : "Пока неверно: результат отличается от эталона.", reply.correct); output.append(result)
            output.append(element("p", "Ваш результат:")); table(output, reply.actual)
            if (!reply.correct) showExpected(reply); else markSolved(b)
          } else {
            reply.results.forEach((data: any, i: number) => { if (reply.results.length > 1) output.append(element("h4", "Команда " + (i + 1))); table(output, data) })
          }
        } catch (e) {
          if (alive()) { output.replaceChildren(); feedback(output, e instanceof Error ? e.message : String(e), false) }
        } finally { if (alive()) run.disabled = false }
      }
      const run = button(isTask ? "Проверить SQL" : "Выполнить", () => { void execute() })
      run.disabled = true
      input.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void execute() } })
      section.append(label, run, element("p", "Каждый запуск — на исходном наборе. Ctrl/Cmd+Enter — выполнить. Таблица показывает до 100 строк.", "iq-muted"), output)
      controls.push(run); sqlOutputs.push(output)
    }
  }
  if (client) {
    const initialize = async () => {
      for (const control of controls) control.disabled = true
      try {
        const reply = await client.request("init")
        if (!alive()) return
        if (!reply.ok) throw new Error(reply.error)
        blocks.filter(b => b.kind === "setup").forEach(b => { b.pre.hidden = true; b.pre.dataset.iqSetup = "ready" })
        controls.forEach(control => { control.disabled = false })
        sqlOutputs.forEach(out => { out.replaceChildren() })
      } catch (e) {
        if (!alive()) return
        const targets = sqlOutputs.length ? sqlOutputs : [blocks[0].pre.parentElement!]
        targets.forEach(out => {
          const msg = element("p", "SQL не готов: " + (e instanceof Error ? e.message : String(e)), "iq-error")
          const retry = button("Повторить загрузку SQL", () => { client.close(); void initialize() })
          out.replaceChildren(msg, retry)
        })
      }
    }
    sqlOutputs.forEach(out => out.append(element("p", "Загрузка SQL-песочницы…", "iq-muted")))
    void initialize()
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    client?.close()
    sortables.forEach(s => s.destroy())
    // Quartz may retain/morph an article node. Restore markers before its next nav.
    mounts.forEach(({ pre, section }) => { if (section.isConnected) section.replaceWith(pre) })
    blocks.filter(b => b.kind === "setup").forEach(b => { b.pre.hidden = false; delete b.pre.dataset.iqSetup })
    progress.remove()
    delete article.dataset.iqMounted
    if (activeArticle === article) activeArticle = undefined
  }
  activeCleanup = cleanup
  if (typeof window.addCleanup === "function") window.addCleanup(cleanup)
}

if (typeof document !== "undefined") document.addEventListener("nav", initInteractive)
export {}
