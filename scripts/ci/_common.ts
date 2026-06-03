import { createHash } from "node:crypto"
import { mkdir, readdir, rm, stat } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"

export const repoRoot = process.cwd()
export const demoRoot = resolve(repoRoot, ".effect-demo")
export const outputsRoot = resolve(demoRoot, "outputs")
export const artifactsRoot = resolve(demoRoot, "artifacts")
export const reportsRoot = resolve(demoRoot, "reports")
export const stateRoot = resolve(demoRoot, "state")

export type InputBag = Record<string, unknown>

export const readInputs = (): InputBag => {
  const raw = process.env.EFFECT_CICD_INPUTS_JSON
  if (raw === undefined || raw.trim().length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const inputString = (inputs: InputBag, name: string, fallback = "") => {
  const value = inputs[name]
  return typeof value === "string" ? value : fallback
}

export const inputBoolean = (inputs: InputBag, name: string, fallback = false) => {
  const value = inputs[name]
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    return value === "true"
  }
  return fallback
}

export const inputNumber = (inputs: InputBag, name: string, fallback = 0) => {
  const value = inputs[name]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export const inputObject = <T>(inputs: InputBag, name: string, fallback: T) => {
  const value = inputs[name]
  return typeof value === "object" && value !== null ? (value as T) : fallback
}

export const requireEnv = (name: string) => {
  const value = process.env[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`Required environment variable ${name} is missing`)
  }
  return value
}

export const ensureDir = async (path: string) => {
  await mkdir(path, { recursive: true })
}

export const writeText = async (path: string, content: string) => {
  await ensureDir(dirname(path))
  await Bun.write(path, content)
}

export const writeJson = async (path: string, value: unknown) => {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`)
}

export const readJsonFile = async <T>(path: string, fallback: T): Promise<T> => {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return fallback
  }

  try {
    const parsed = JSON.parse(await file.text())
    return parsed as T
  } catch {
    return fallback
  }
}

export const resetDemoState = async () => {
  await rm(demoRoot, { recursive: true, force: true })
}

export const log = (message: string) => {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

export const divider = (label: string) => {
  console.log(`\n=== ${label} ===`)
}

export const sleep = async (milliseconds: number, message?: string) => {
  if (message !== undefined) {
    log(message)
  }
  await Bun.sleep(milliseconds)
}

export const runProcess = async (command: ReadonlyArray<string>) => {
  const subprocess = Bun.spawn(command, {
    cwd: repoRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ])

  return { stdout, stderr, exitCode }
}

export const listFiles = async (targets: ReadonlyArray<string>) => {
  const files = new Array<string>()

  for (const target of targets) {
    const resolvedTarget = resolve(repoRoot, target)
    let metadata
    try {
      metadata = await stat(resolvedTarget)
    } catch {
      continue
    }

    if (metadata.isFile()) {
      files.push(resolvedTarget)
      continue
    }

    files.push(...(await walkDirectory(resolvedTarget)))
  }

  return files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

const walkDirectory = async (directory: string): Promise<Array<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = new Array<string>()

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(path)))
      continue
    }
    files.push(path)
  }

  return files
}

export const workspaceFingerprint = async (targets: ReadonlyArray<string>) => {
  const hash = createHash("sha256")
  const files = await listFiles(targets)

  for (const path of files) {
    const content = await Bun.file(path).text().catch(() => "")
    const fileStat = await stat(path)
    hash.update(relative(repoRoot, path))
    hash.update(`:${fileStat.size}:`)
    hash.update(content)
    hash.update("\n")
  }

  return hash.digest("hex")
}

export const markdownList = (items: ReadonlyArray<string>) => items.map((item) => `- ${item}`).join("\n")

export const bytesForFiles = async (files: ReadonlyArray<string>) => {
  let total = 0
  for (const file of files) {
    total += (await stat(file)).size
  }
  return total
}
