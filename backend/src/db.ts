import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import {
  DatabaseSchema,
  Lesson,
  Program,
  UpsellSettings,
  Visibility,
} from "./types.js";

const resolveDataDir = () => {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  if (process.env.VERCEL) {
    return path.resolve("/tmp", "startupsprint-data");
  }
  return path.resolve(process.cwd(), "data");
};

const DATA_DIR = resolveDataDir();
const DATA_FILE = path.join(DATA_DIR, "db.json");

export const dataPaths = {
  dir: DATA_DIR,
  file: DATA_FILE,
};

const now = () => new Date().toISOString();

const seedProgram = (): { program: Program; lessons: Lesson[] } => {
  const programId = uuid();
  const createdAt = now();
  const program: Program = {
    id: programId,
    name: "14-дневный стартап-спринт",
    description:
      "Практический интенсив: каждый день ты получаешь задание, видео и понятные шаги к запуску продукта.",
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };

  const baseLesson = (index: number, visibility: Visibility): Lesson => ({
    id: uuid(),
    programId,
    orderIndex: index,
    title: index === 1 ? "Фокус и постановка цели" : "Гипотеза ценности",
    description:
      index === 1
        ? "Уточняем целевую аудиторию и формулируем чёткую цель спринта."
        : "Разбираемся, что именно мы обещаем пользователю и за что он будет платить.",
    videoUrl:
      "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    homeworkText:
      index === 1
        ? "Опиши клиента и ожидаемый результат спринта в 3 предложениях."
        : "Сформулируй ценностное предложение и выгрузку для будущего лендинга.",
    visibility,
    delayHoursFromPrevious: index === 1 ? 0 : 12,
    expiresInHours: 48,
    createdAt,
    updatedAt: createdAt,
  });

  const lessons: Lesson[] = [baseLesson(1, "FREE"), baseLesson(2, "PAID")];
  return { program, lessons };
};

const seedUpsell = (): UpsellSettings => ({
  id: uuid(),
  title: "Получите полный доступ к спринту",
  text:
    "Подключитесь к платному каналу и откройте все материалы, живые созвоны и поддержку ментора.",
  buttonLabel: "Открыть платный доступ",
  buttonUrl: "https://t.me/+example",
  updatedAt: now(),
});

const defaultData = (): DatabaseSchema => {
  const { program, lessons } = seedProgram();
  return {
    programs: [program],
    lessons,
    users: [],
    userProgramProgress: [],
    userLessonProgress: [],
    upsell: seedUpsell(),
    adminSessions: [],
  };
};

class JsonStore {
  private data: DatabaseSchema | null = null;

  async ensureFile() {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      const initial = defaultData();
      await writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
      this.data = initial;
    }
  }

  async load(): Promise<DatabaseSchema> {
    if (this.data) return this.data;
    await this.ensureFile();
    const content = await readFile(DATA_FILE, "utf-8");
    this.data = JSON.parse(content) as DatabaseSchema;
    return this.data;
  }

  async persist() {
    if (!this.data) return;
    await writeFile(DATA_FILE, JSON.stringify(this.data, null, 2), "utf-8");
  }

  async read(): Promise<DatabaseSchema> {
    return this.load();
  }

  async mutate(updater: (data: DatabaseSchema) => void) {
    const data = await this.load();
    updater(data);
    await this.persist();
  }
}

export const db = new JsonStore();


