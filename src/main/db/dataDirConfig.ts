import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ValidationFailure } from './dataDirValidation.js'

export const CONFIG_FILE_NAME = 'config.json'
export const CONFIG_VERSION = 1

export interface BootstrapConfig {
  version: number
  dataDir: string
}

export type ConfigProblemKind =
  | 'unreadable'
  | 'invalid-json'
  | 'bad-version'
  | 'bad-data-dir'
  | 'unusable-dir'

export interface ConfigProblem {
  kind: ConfigProblemKind
  detail: string
  fingerprint: string
}

export type DataDirSource = 'env' | 'cli' | 'config' | 'portable' | 'default'

export interface DataDirResolution {
  dir: string
  source: DataDirSource
  configPath: string
  problem: ConfigProblem | null
}

export interface ResolveDataDirInput {
  env: NodeJS.ProcessEnv
  argv: readonly string[]
  appDataDir: string
  exeDir: string
  defaultUserDataDir: string
  validate?: (dir: string) => ValidationFailure | null
}

function hashBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function validationFailureText(failure: ValidationFailure): string {
  switch (failure) {
    case 'not-absolute':
      return '不是绝对路径'
    case 'unc-or-network':
      return '是网络路径或网络挂载'
    case 'system-dir':
      return '位于系统目录'
    case 'inside-resources':
      return '位于应用打包目录内'
    case 'unwritable':
      return '不可写'
    default:
      return failure satisfies never
  }
}

export function configPathFor(
  appDataDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const envDir = env.TODO_CONFIG_DIR
  if (envDir) {
    return path.join(envDir, CONFIG_FILE_NAME)
  }
  return path.join(appDataDir, 'ToDoList', CONFIG_FILE_NAME)
}

interface InspectConfigResult {
  config: BootstrapConfig | null
  problem: ConfigProblem | null
  fingerprint: string
}

function inspectConfig(file: string): InspectConfigResult {
  let bytes: Buffer
  try {
    bytes = fs.readFileSync(file)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return { config: null, problem: null, fingerprint: '' }
    }
    return {
      config: null,
      problem: {
        kind: 'unreadable',
        detail: `无法读取配置文件 ${file}：${messageOf(error)}`,
        fingerprint: '',
      },
      fingerprint: '',
    }
  }

  const fingerprint = hashBytes(bytes)

  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf-8'))
  } catch (error) {
    return {
      config: null,
      problem: {
        kind: 'invalid-json',
        detail: `配置文件不是合法 JSON：${file}（${messageOf(error)}）`,
        fingerprint,
      },
      fingerprint,
    }
  }

  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    return {
      config: null,
      problem: {
        kind: 'bad-version',
        detail: `配置版本不受支持（需要 ${CONFIG_VERSION}，读到缺失）：${file}`,
        fingerprint,
      },
      fingerprint,
    }
  }

  const record = parsed as { version: unknown; dataDir: unknown }

  if (record.version !== CONFIG_VERSION) {
    return {
      config: null,
      problem: {
        kind: 'bad-version',
        detail: `配置版本不受支持（需要 ${CONFIG_VERSION}，读到 ${String(record.version)}）：${file}`,
        fingerprint,
      },
      fingerprint,
    }
  }

  if (typeof record.dataDir !== 'string') {
    return {
      config: null,
      problem: {
        kind: 'bad-data-dir',
        detail: `dataDir 缺失或不是字符串：${file}`,
        fingerprint,
      },
      fingerprint,
    }
  }

  if (!path.isAbsolute(record.dataDir) || record.dataDir.includes('~')) {
    return {
      config: null,
      problem: {
        kind: 'bad-data-dir',
        detail: `dataDir 必须是合法绝对路径：${record.dataDir}（${file}）`,
        fingerprint,
      },
      fingerprint,
    }
  }

  return {
    config: { version: CONFIG_VERSION, dataDir: record.dataDir },
    problem: null,
    fingerprint,
  }
}

export function readConfig(file: string): {
  config: BootstrapConfig | null
  problem: ConfigProblem | null
} {
  const { config, problem } = inspectConfig(file)
  return { config, problem }
}

export function writeConfigAtomic(file: string, config: BootstrapConfig): void {
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const payload = JSON.stringify(
    { version: CONFIG_VERSION, dataDir: config.dataDir },
    null,
    2,
  )
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, payload, 'utf-8')
  fs.renameSync(temp, file)
}

export function parseCliDataDir(argv: readonly string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith('--data-dir=')) {
      const value = arg.slice('--data-dir='.length)
      return value.length > 0 ? value : null
    }
  }
  return null
}

export function portableDir(exeDir: string): string | null {
  const marker = path.join(exeDir, 'portable.txt')
  if (fs.existsSync(marker)) {
    return path.join(exeDir, 'data')
  }
  return null
}

function warnSpaceFormCli(argv: readonly string[]): void {
  for (const arg of argv) {
    if (arg === '--data-dir') {
      console.warn(
        '警告：--data-dir 需使用等号形式（--data-dir=<路径>），空格形式已忽略',
      )
      return
    }
  }
}

export function resolveDataDir(input: ResolveDataDirInput): DataDirResolution {
  const { env, argv, appDataDir, exeDir, defaultUserDataDir } = input
  const configPath = configPathFor(appDataDir, env)
  const validate = input.validate

  if (env.TODO_USER_DATA_DIR) {
    return {
      dir: env.TODO_USER_DATA_DIR,
      source: 'env',
      configPath,
      problem: null,
    }
  }

  warnSpaceFormCli(argv)

  const cliDir = parseCliDataDir(argv)
  if (cliDir !== null) {
    const failure = validate?.(cliDir) ?? null
    if (failure === null) {
      return { dir: cliDir, source: 'cli', configPath, problem: null }
    }
    return {
      dir: defaultUserDataDir,
      source: 'default',
      configPath,
      problem: {
        kind: 'unusable-dir',
        detail: `--data-dir 指向的目录不可用（${validationFailureText(failure)}）：${cliDir}`,
        fingerprint: '',
      },
    }
  }

  const {
    config,
    problem: configProblem,
    fingerprint,
  } = inspectConfig(configPath)

  if (configProblem) {
    return {
      dir: defaultUserDataDir,
      source: 'default',
      configPath,
      problem: configProblem,
    }
  }

  if (config) {
    const failure = validate?.(config.dataDir) ?? null
    if (failure === null) {
      return {
        dir: config.dataDir,
        source: 'config',
        configPath,
        problem: null,
      }
    }
    return {
      dir: defaultUserDataDir,
      source: 'default',
      configPath,
      problem: {
        kind: 'unusable-dir',
        detail: `配置的数据目录不可用（${validationFailureText(failure)}）：${config.dataDir}`,
        fingerprint,
      },
    }
  }

  const portable = portableDir(exeDir)
  if (portable !== null) {
    const failure = validate?.(portable) ?? null
    if (failure === null) {
      return { dir: portable, source: 'portable', configPath, problem: null }
    }
    return {
      dir: defaultUserDataDir,
      source: 'default',
      configPath,
      problem: {
        kind: 'unusable-dir',
        detail: `便携模式的数据目录不可用（${validationFailureText(failure)}）：${portable}`,
        fingerprint: '',
      },
    }
  }

  return {
    dir: defaultUserDataDir,
    source: 'default',
    configPath,
    problem: null,
  }
}
