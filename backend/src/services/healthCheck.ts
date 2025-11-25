import { access, constants } from "fs/promises";
import { dataPaths, db } from "../db.js";

export type HealthStatus = "ok" | "degraded";

interface CheckResult {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  checks: {
    env: CheckResult;
    dataDir: CheckResult;
    database: CheckResult;
  };
}

const REQUIRED_ENV = ["ADMIN_PASSWORD", "CLIENT_ORIGIN"];

const checkEnv = (): CheckResult => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    return {
      ok: false,
      message: `Отсутствуют переменные: ${missing.join(", ")}`,
    };
  }
  return { ok: true };
};

const checkDataDir = async (): Promise<CheckResult> => {
  try {
    await access(dataPaths.dir, constants.R_OK | constants.W_OK);
    return { ok: true, details: { dir: dataPaths.dir } };
  } catch (error) {
    return {
      ok: false,
      message: "Нет доступа к DATA_DIR",
      details: { dir: dataPaths.dir, error: (error as Error).message },
    };
  }
};

const checkDatabase = async (): Promise<CheckResult> => {
  try {
    const snapshot = await db.read();
    return {
      ok: true,
      details: {
        programs: snapshot.programs.length,
        lessons: snapshot.lessons.length,
        users: snapshot.users.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: "Не удалось прочитать файловую БД",
      details: { error: (error as Error).message },
    };
  }
};

export const runHealthCheck = async (): Promise<HealthReport> => {
  const [dataDir, database] = await Promise.all([checkDataDir(), checkDatabase()]);
  const env = checkEnv();
  const hasFailure = [env, dataDir, database].some((check) => !check.ok);

  return {
    status: hasFailure ? "degraded" : "ok",
    timestamp: new Date().toISOString(),
    checks: {
      env,
      dataDir,
      database,
    },
  };
};


