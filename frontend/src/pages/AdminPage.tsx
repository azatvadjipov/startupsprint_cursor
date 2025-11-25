import { type FormEvent, useEffect, useState } from "react";
import { AdminApi } from "../api/adminClient";
import { HttpError } from "../api/http";
import type {
  AdminLesson,
  AdminProgram,
  AdminStats,
  LessonVisibility,
  UpsellSettings,
} from "../types";

type Section = "programs" | "lessons" | "upsell" | "stats";

const defaultLessonForm: Partial<AdminLesson> = {
  title: "",
  description: "",
  videoUrl: "",
  homeworkText: "",
  visibility: "FREE",
  delayHoursFromPrevious: 0,
  expiresInHours: 48,
};

const AdminPage = () => {
  const [authState, setAuthState] = useState<"checking" | "login" | "ready">("checking");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState<Section>("programs");
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<AdminLesson[]>([]);
  const [lessonForm, setLessonForm] = useState<Partial<AdminLesson>>(defaultLessonForm);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<UpsellSettings | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPrograms = async () => {
    try {
      const list = await AdminApi.getPrograms();
      setPrograms(list);
      if (!selectedProgramId && list.length) {
        setSelectedProgramId(list[0].id);
      }
      setAuthState("ready");
      setError(null);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        setAuthState("login");
        return;
      }
      setError((err as Error).message);
    }
  };

  const loadLessons = async (programId: string) => {
    try {
      const data = await AdminApi.getLessons(programId);
      setLessons(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadUpsell = async () => {
    try {
      const data = await AdminApi.getUpsell();
      setUpsell(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const loadStats = async () => {
    try {
      const data = await AdminApi.getStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgramId) {
      loadLessons(selectedProgramId);
    } else {
      setLessons([]);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    if (section === "upsell" && !upsell) {
      loadUpsell();
    }
    if (section === "stats") {
      loadStats();
    }
  }, [section]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await AdminApi.login(password);
      setPassword("");
      await loadPrograms();
      setSection("programs");
      setToast("Добро пожаловать!");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCreateProgram = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await AdminApi.createProgram({
        name: form.get("name") as string,
        description: (form.get("description") as string) ?? "",
        isActive: Boolean(form.get("isActive")),
      });
      await loadPrograms();
      setToast("Программа создана");
      e.currentTarget.reset();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateProgram = async (program: AdminProgram) => {
    try {
      await AdminApi.updateProgram(program.id, {
        isActive: true,
      });
      await loadPrograms();
      setToast("Настройки программы сохранены");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const resetLessonForm = () => {
    setLessonForm(defaultLessonForm);
    setEditingLessonId(null);
  };

  const submitLessonForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProgramId) {
      setError("Сначала выберите программу");
      return;
    }
    try {
      if (editingLessonId) {
        await AdminApi.updateLesson(editingLessonId, lessonForm);
        setToast("Урок обновлён");
      } else {
        await AdminApi.createLesson(selectedProgramId, {
          ...lessonForm,
        });
        setToast("Урок создан");
      }
      await loadLessons(selectedProgramId);
      resetLessonForm();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const editLesson = (lesson: AdminLesson) => {
    setEditingLessonId(lesson.id);
    setLessonForm({
      ...lesson,
    });
  };

  const deleteLesson = async (id: string) => {
    if (!selectedProgramId) return;
    try {
      await AdminApi.deleteLesson(id);
      await loadLessons(selectedProgramId);
      setToast("Урок удалён");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const moveLesson = async (id: string, direction: "up" | "down") => {
    if (!selectedProgramId) return;
    try {
      await AdminApi.moveLesson(id, direction);
      await loadLessons(selectedProgramId);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const saveUpsell = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await AdminApi.updateUpsell({
        title: (form.get("title") as string) ?? "",
        text: (form.get("text") as string) ?? "",
        buttonLabel: (form.get("buttonLabel") as string) ?? "",
        buttonUrl: (form.get("buttonUrl") as string) ?? "",
      });
      await loadUpsell();
      setToast("Апселл сохранён");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const logout = async () => {
    try {
      await AdminApi.logout();
      setAuthState("login");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (authState === "checking") {
    return (
      <div className="admin-layout">
        <p>Проверяем сессию...</p>
      </div>
    );
  }

  if (authState === "login") {
    return (
      <div className="admin-layout">
        <h2>Вход в админку</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите ADMIN_PASSWORD"
            />
          </div>
          <button className="button" type="submit">
            Войти
          </button>
        </form>
        {error && <p className="error-banner" style={{ marginTop: 16 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Админка «Стартап-спринт»</h1>
        <button className="button outline" style={{ width: "auto" }} onClick={logout}>
          Выйти
        </button>
      </header>

      <nav className="admin-nav">
        {(["programs", "lessons", "upsell", "stats"] as Section[]).map((tab) => (
          <button
            key={tab}
            className={`button ${section === tab ? "" : "secondary"}`}
            onClick={() => setSection(tab)}
            style={{ width: "auto" }}
          >
            {tab === "programs" && "Программы"}
            {tab === "lessons" && "Уроки"}
            {tab === "upsell" && "Апселл"}
            {tab === "stats" && "Статистика"}
          </button>
        ))}
      </nav>

      {toast && (
        <div className="card" style={{ background: "#dcfce7" }}>
          <strong>{toast}</strong>
          <button className="button outline" style={{ marginTop: 10 }} onClick={() => setToast(null)}>
            Понятно
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {section === "programs" && (
        <>
          <div className="card">
            <h2>Список программ</h2>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Уроков</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {programs.map((program) => (
                  <tr key={program.id}>
                    <td>{program.name}</td>
                    <td>{program.lessonsCount}</td>
                    <td>{program.isActive ? "Активна" : "Неактивна"}</td>
                    <td>
                      {!program.isActive && (
                        <button className="button secondary" onClick={() => handleUpdateProgram(program)}>
                          Сделать активной
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>Создать программу</h2>
            <form onSubmit={handleCreateProgram}>
              <div className="input-group">
                <label htmlFor="program-name">Название</label>
                <input id="program-name" name="name" placeholder="Например, «Запуск MVP»" required />
              </div>
              <div className="input-group">
                <label htmlFor="program-description">Описание</label>
                <textarea id="program-description" name="description" placeholder="Коротко о программе" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <input type="checkbox" name="isActive" defaultChecked /> Сделать активной
              </label>
              <button className="button" type="submit">
                Сохранить
              </button>
            </form>
          </div>
        </>
      )}

      {section === "lessons" && (
        <>
          <div className="card">
            <h2>Уроки программы</h2>
            <div className="input-group">
              <label>Выберите программу</label>
              <select
                value={selectedProgramId ?? ""}
                onChange={(event) => setSelectedProgramId(event.target.value || null)}
              >
                <option value="">—</option>
                {programs.map((program) => (
                  <option value={program.id} key={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            {lessons.length > 0 ? (
              <table className="list-table">
                <thead>
                  <tr>
                    <th>Порядок</th>
                    <th>Название</th>
                    <th>Доступ</th>
                    <th>Задержка</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson) => (
                    <tr key={lesson.id}>
                      <td>{lesson.orderIndex}</td>
                      <td>{lesson.title}</td>
                      <td>{lesson.visibility}</td>
                      <td>{lesson.delayHoursFromPrevious} ч</td>
                      <td>
                        <div className="inline-actions">
                          <button className="button secondary" onClick={() => editLesson(lesson)}>
                            Редактировать
                          </button>
                          <button className="button secondary" onClick={() => moveLesson(lesson.id, "up")}>
                            ↑
                          </button>
                          <button className="button secondary" onClick={() => moveLesson(lesson.id, "down")}>
                            ↓
                          </button>
                          <button className="button secondary" onClick={() => deleteLesson(lesson.id)}>
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Уроков пока нет.</p>
            )}
          </div>
          <div className="card">
            <h2>{editingLessonId ? "Редактирование урока" : "Новый урок"}</h2>
            <form onSubmit={submitLessonForm}>
              <div className="input-group">
                <label>Название</label>
                <input
                  value={lessonForm.title ?? ""}
                  onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value })}
                  required
                />
              </div>
              <div className="input-group">
                <label>Описание (HTML разрешён)</label>
                <textarea
                  value={lessonForm.description ?? ""}
                  onChange={(event) => setLessonForm({ ...lessonForm, description: event.target.value })}
                />
              </div>
              <div className="input-group">
                <label>URL видео</label>
                <input
                  value={lessonForm.videoUrl ?? ""}
                  onChange={(event) => setLessonForm({ ...lessonForm, videoUrl: event.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div className="input-group">
                <label>Домашка</label>
                <textarea
                  value={lessonForm.homeworkText ?? ""}
                  onChange={(event) => setLessonForm({ ...lessonForm, homeworkText: event.target.value })}
                />
              </div>
              <div className="input-group">
                <label>Видимость</label>
                <select
                  value={(lessonForm.visibility as LessonVisibility) ?? "FREE"}
                  onChange={(event) =>
                    setLessonForm({ ...lessonForm, visibility: event.target.value as LessonVisibility })
                  }
                >
                  <option value="FREE">FREE</option>
                  <option value="PAID">PAID</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className="input-group">
                <label>Задержка до открытия (часы)</label>
                <input
                  type="number"
                  value={lessonForm.delayHoursFromPrevious ?? 0}
                  min={0}
                  onChange={(event) =>
                    setLessonForm({ ...lessonForm, delayHoursFromPrevious: Number(event.target.value) })
                  }
                />
              </div>
              <div className="input-group">
                <label>Время до сгорания (часы)</label>
                <input
                  type="number"
                  value={lessonForm.expiresInHours ?? 48}
                  min={1}
                  onChange={(event) =>
                    setLessonForm({ ...lessonForm, expiresInHours: Number(event.target.value) })
                  }
                />
              </div>
              <button className="button" type="submit">
                {editingLessonId ? "Сохранить изменения" : "Создать урок"}
              </button>
              {editingLessonId && (
                <button
                  type="button"
                  className="button outline"
                  style={{ marginTop: 10 }}
                  onClick={resetLessonForm}
                >
                  Отменить
                </button>
              )}
            </form>
          </div>
        </>
      )}

      {section === "upsell" && (
        <div className="card">
          <h2>Апселл для бесплатной аудитории</h2>
          <form key={upsell?.updatedAt ?? "new"} onSubmit={saveUpsell}>
            <div className="input-group">
              <label htmlFor="title">Заголовок</label>
              <input id="title" name="title" defaultValue={upsell?.title ?? ""} required />
            </div>
            <div className="input-group">
              <label htmlFor="text">Текст</label>
              <textarea id="text" name="text" defaultValue={upsell?.text ?? ""} required />
            </div>
            <div className="input-group">
              <label htmlFor="buttonLabel">Текст кнопки</label>
              <input id="buttonLabel" name="buttonLabel" defaultValue={upsell?.buttonLabel ?? ""} required />
            </div>
            <div className="input-group">
              <label htmlFor="buttonUrl">Ссылка</label>
              <input id="buttonUrl" name="buttonUrl" defaultValue={upsell?.buttonUrl ?? ""} required />
            </div>
            <button className="button" type="submit">
              Сохранить
            </button>
          </form>
        </div>
      )}

      {section === "stats" && stats && (
        <div className="card">
          <h2>Статистика</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            <li>
              <strong>Пользователей:</strong> {stats.users}
            </li>
            <li>
              <strong>Платных:</strong> {stats.paid}
            </li>
            <li>
              <strong>Завершили программу:</strong> {stats.completed}
            </li>
            <li>
              <strong>Спринт сгорел:</strong> {stats.failed}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

