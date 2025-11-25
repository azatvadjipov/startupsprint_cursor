import { useEffect, useMemo, useState } from "react";
import { AppClientApi } from "../api/appClient";
import { getTelegramUserId } from "../lib/telegram";
import { formatCountdown, formatDateTime, timeUntil } from "../utils/time";
import type { AuthResponse, Lesson, ProgramPayload } from "../types";

type UiState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AuthResponse };

const statusLabels: Record<Lesson["userStatus"], string> = {
  LOCKED: "Заблокирован",
  AVAILABLE: "Доступен",
  EXPIRED: "Сгорел",
  DONE: "Пройден",
};

const ClientAppPage = () => {
  const [state, setState] = useState<UiState>({ status: "loading" });
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [showLessonsAfterComplete, setShowLessonsAfterComplete] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchInitialData = async () => {
    setState({ status: "loading" });
    setBanner(null);
    try {
      const telegramId = getTelegramUserId();
      const payload = await AppClientApi.auth(telegramId);
      setState({ status: "ready", data: payload });
    } catch (error) {
      setState({
        status: "error",
        message: (error as Error).message ?? "Не удалось загрузить данные",
      });
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const applyPayload = (payload: ProgramPayload & { userId: string; isPaid: boolean }) => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        status: "ready",
        data: {
          ...prev.data,
          ...payload,
        },
      };
    });
  };

  const handleLessonSelect = async (lesson: Lesson) => {
    if (state.status !== "ready") return;
    let canAccessPaid = state.data.isPaid;
    if (!canAccessPaid && lesson.visibility === "PAID") {
      try {
        const membership = await AppClientApi.checkMembership(state.data.telegramId);
        canAccessPaid = membership.isPaid;
        if (membership.isPaid) {
          await handleRefresh();
        } else {
          setBanner(membership.membershipReason ?? "Подключите платный канал, чтобы открыть урок.");
          setShowUpsell(true);
          return;
        }
      } catch (error) {
        setBanner((error as Error).message);
        return;
      }
    }
    setSelectedLessonId(lesson.id);
    if (lesson.userStatus === "AVAILABLE" && !lesson.unlockedAt) {
      try {
        const payload = await AppClientApi.startLesson(state.data.userId, lesson.id);
        applyPayload(payload);
      } catch (error) {
        setBanner((error as Error).message);
      }
    }
  };

  const handleLessonComplete = async (lesson: Lesson) => {
    if (state.status !== "ready") return;
    try {
      const payload = await AppClientApi.completeLesson(state.data.userId, lesson.id);
      applyPayload(payload);
      setBanner("Отлично! Урок отмечен как пройден ✅");
    } catch (error) {
      setBanner((error as Error).message);
    }
  };

  const handleRestart = async () => {
    if (state.status !== "ready") return;
    try {
      const payload = await AppClientApi.restartProgram(state.data.userId);
      applyPayload(payload);
      setSelectedLessonId(null);
      setShowLessonsAfterComplete(false);
      setBanner("Спринт запущен заново");
    } catch (error) {
      setBanner((error as Error).message);
    }
  };

  const handleRefresh = async () => {
    if (state.status !== "ready") return;
    try {
      const payload = await AppClientApi.getProgress(state.data.userId);
      applyPayload(payload);
    } catch (error) {
      setBanner((error as Error).message);
    }
  };

  const closeUpsell = () => setShowUpsell(false);

  if (state.status === "loading") {
    return (
      <div className="app-shell">
        <Loader message="Собираем данные из Telegram..." />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="app-shell">
        <ErrorState message={state.message} onRetry={fetchInitialData} />
      </div>
    );
  }

  const { data } = state;
  const { program, lessons, completedLessons, totalLessons, progressStatus, upsell } = data;
  const progressPercent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  if (!program) {
    return (
      <div className="app-shell">
        <EmptyState
          title="Активная программа пока не создана"
          description="Попросите куратора включить спринт в админке."
        />
      </div>
    );
  }

  if (progressStatus === "FAILED") {
    return (
      <div className="app-shell">
        <SprintFailedCard onRestart={handleRestart} onRefresh={handleRefresh} />
      </div>
    );
  }

  const showCompletion = progressStatus === "COMPLETED" && !showLessonsAfterComplete;

  const content = showCompletion ? (
    <CompletionCard
      lessonsCount={totalLessons}
      onShowLessons={() => {
        setShowLessonsAfterComplete(true);
        setSelectedLessonId(null);
      }}
    />
  ) : selectedLesson ? (
    <LessonDetails
      lesson={selectedLesson}
      lessons={lessons}
      isPaidUser={data.isPaid}
      onBack={() => setSelectedLessonId(null)}
      onComplete={() => handleLessonComplete(selectedLesson)}
      tick={tick}
    />
  ) : (
    <>
      <div className="card">
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>{program.name}</h1>
        <p style={{ marginTop: 0, color: "#4b5563" }}>{program.description}</p>
        <div style={{ marginTop: 16 }}>
          <div className="section-title">
            Прогресс: {completedLessons} из {totalLessons}
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        {!data.isPaid && (
          <div className="error-banner" style={{ marginTop: 16 }}>
            <div>Вы в бесплатном доступе. Платные уроки откроются после подписки на канал.</div>
            {data.membershipReason && (
              <small style={{ display: "block", marginTop: 6 }}>{data.membershipReason}</small>
            )}
          </div>
        )}
      </div>
      {banner && (
        <div className="card" style={{ background: "#fef9c3" }}>
          <strong>{banner}</strong>
          <button className="button outline" style={{ marginTop: 12 }} onClick={() => setBanner(null)}>
            Скрыть
          </button>
        </div>
      )}
      <div className="card">
        <div className="section-title">Расписание уроков</div>
        <LessonList
          lessons={lessons}
          isPaidUser={data.isPaid}
          onSelect={handleLessonSelect}
          tick={tick}
        />
      </div>
    </>
  );

  return (
    <div className="app-shell">
      {content}
      {showUpsell && upsell && (
        <UpsellScreen settings={upsell} onClose={closeUpsell} />
      )}
    </div>
  );
};

const Loader = ({ message }: { message: string }) => (
  <div className="card">
    <p>{message}</p>
    <div className="progress-bar" style={{ marginTop: 12 }}>
      <div className="progress-bar__fill" style={{ width: "60%" }} />
    </div>
  </div>
);

const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div className="card">
    <h2>Что-то пошло не так 😢</h2>
    <p>{message}</p>
    <button className="button" onClick={onRetry}>
      Попробовать снова
    </button>
  </div>
);

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="card">
    <h2>{title}</h2>
    <p>{description}</p>
  </div>
);

const LessonList = ({
  lessons,
  isPaidUser,
  onSelect,
  tick,
}: {
  lessons: Lesson[];
  isPaidUser: boolean;
  onSelect: (lesson: Lesson) => void;
  tick: number;
}) => {
  return (
    <div className="lesson-list" key={tick}>
      {lessons.map((lesson) => {
        const isLockedPaid = lesson.visibility === "PAID" && !isPaidUser;
        const isLockedTime =
          lesson.userStatus === "LOCKED" && lesson.unlockedAt && new Date(lesson.unlockedAt) > new Date();
        const countdown = isLockedTime ? formatCountdown(lesson.unlockedAt) : null;
        const statusClass = [
          lesson.userStatus === "DONE" ? "done" : "",
          isLockedPaid || lesson.userStatus === "LOCKED" ? "locked" : "",
        ]
          .join(" ")
          .trim();

        return (
          <div
            key={lesson.id}
            className={`lesson-card ${statusClass}`}
            onClick={() => onSelect(lesson)}
            role="button"
            style={{ cursor: "pointer" }}
          >
            <div className="lesson-card__meta">День {lesson.orderIndex}</div>
            <div className="lesson-card__title">{lesson.title}</div>
            <div className="lesson-card__meta">
              <span className={`badge ${lesson.visibility === "PAID" ? "paid" : "free"}`}>
                {lesson.visibility === "PAID" ? "Платный" : "Бесплатный"}
              </span>
              <span
                className={`status-pill ${
                  lesson.userStatus === "LOCKED"
                    ? "locked"
                    : lesson.userStatus === "EXPIRED"
                    ? "expired"
                    : lesson.visibility === "PAID" && !isPaidUser
                    ? "paid"
                    : ""
                }`}
              >
                {isLockedPaid ? "Нужна подписка" : statusLabels[lesson.userStatus]}
              </span>
              {countdown && <span>Откроется через {countdown}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LessonDetails = ({
  lesson,
  lessons,
  onBack,
  onComplete,
  isPaidUser,
  tick,
}: {
  lesson: Lesson;
  lessons: Lesson[];
  onBack: () => void;
  onComplete: () => void;
  isPaidUser: boolean;
  tick: number;
}) => {
  const nextLesson = useMemo(() => {
    const index = lessons.findIndex((item) => item.id === lesson.id);
    return index >= 0 ? lessons[index + 1] : undefined;
  }, [lesson.id, lessons]);

  const needFomoWarning = lesson.userStatus === "AVAILABLE" && lesson.expiresAt;
  const showStartButton = lesson.userStatus === "AVAILABLE" && !lesson.unlockedAt;

  return (
    <div className="card" key={`${lesson.id}-${tick}`}>
      <button className="button secondary" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Назад к программе
      </button>
      <div className="lesson-card__meta">День {lesson.orderIndex}</div>
      <h2>{lesson.title}</h2>
      <VideoPlayer url={lesson.videoUrl} />
      <div
        style={{ lineHeight: 1.6, color: "#475569", marginTop: 16 }}
        dangerouslySetInnerHTML={{ __html: lesson.description }}
      />
      <div style={{ marginTop: 20 }}>
        <div className="section-title">Домашка</div>
        <p style={{ whiteSpace: "pre-line" }}>{lesson.homeworkText}</p>
      </div>
      {needFomoWarning && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          Этот урок нужно пройти до {formatDateTime(lesson.expiresAt)}. Осталось {timeUntil(lesson.expiresAt)}.
        </div>
      )}
      {nextLesson && nextLesson.unlockedAt && nextLesson.userStatus === "LOCKED" && (
        <p style={{ marginTop: 12, color: "#4c1d95" }}>
          Следующий урок откроется через {timeUntil(nextLesson.unlockedAt)}.
        </p>
      )}
      {lesson.userStatus === "DONE" ? (
        <button className="button secondary" disabled style={{ marginTop: 16 }}>
          Урок пройден
        </button>
      ) : lesson.userStatus === "AVAILABLE" ? (
        <button className="button" style={{ marginTop: 16 }} onClick={onComplete}>
          Отметить урок как пройден
        </button>
      ) : (
        <div className="error-banner" style={{ marginTop: 16 }}>
          Урок ещё недоступен. Проверьте таймер или статус подписки.
        </div>
      )}
      {!isPaidUser && lesson.visibility === "PAID" && (
        <div className="error-banner" style={{ marginTop: 16 }}>
          Этот урок только для платных учеников.
        </div>
      )}
      {showStartButton && (
        <p style={{ marginTop: 12, color: "#10b981" }}>
          Урок разблокирован, таймер запущен!
        </p>
      )}
    </div>
  );
};

const VideoPlayer = ({ url }: { url: string }) => {
  if (!url) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: 24,
          borderRadius: 16,
          background: "#f1f5f9",
          textAlign: "center",
        }}
      >
        Видео появится позже
      </div>
    );
  }
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (isYouTube) {
    const embedUrl = url.replace("watch?v=", "embed/");
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginTop: 16 }}>
        <iframe
          src={embedUrl}
          title="lesson-video"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: 16 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <video style={{ width: "100%", borderRadius: 16, marginTop: 16 }} controls src={url}>
      Ваш браузер не поддерживает воспроизведение видео.
    </video>
  );
};

const UpsellScreen = ({
  settings,
  onClose,
}: {
  settings: NonNullable<ProgramPayload["upsell"]>;
  onClose: () => void;
}) => (
  <div className="card" style={{ border: "2px solid #f97316" }}>
    <h2>{settings.title}</h2>
    <p style={{ color: "#4b5563" }}>{settings.text}</p>
    <button
      className="button"
      onClick={() => {
        window.open(settings.buttonUrl, "_blank");
      }}
    >
      {settings.buttonLabel}
    </button>
    <button className="button outline" style={{ marginTop: 12 }} onClick={onClose}>
      Назад
    </button>
  </div>
);

const SprintFailedCard = ({ onRestart, onRefresh }: { onRestart: () => void; onRefresh: () => void }) => (
  <div className="card">
    <h2>Спринт сгорел 😢</h2>
    <p>
      Вы не успели пройти урок вовремя. Чтобы продолжить, начните спринт сначала. Мы сбросим прогресс и откроем первый
      урок.
    </p>
    <button className="button" onClick={onRestart}>
      Начать сначала
    </button>
    <button className="button outline" style={{ marginTop: 12 }} onClick={onRefresh}>
      Обновить данные
    </button>
  </div>
);

const CompletionCard = ({ lessonsCount, onShowLessons }: { lessonsCount: number; onShowLessons: () => void }) => (
  <div className="card">
    <h2>Поздравляем! Ты прошёл спринт 🎉</h2>
    <p>
      Все {lessonsCount} уроков закрыты. Забери инсайты и пересмотри записи в любой момент.
    </p>
    <button className="button" onClick={onShowLessons}>
      Посмотреть все уроки
    </button>
  </div>
);

export default ClientAppPage;

