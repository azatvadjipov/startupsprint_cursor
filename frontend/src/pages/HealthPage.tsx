import { useEffect, useState } from "react";
import { httpRequest } from "../api/http";

type HealthCheck = {
  ok: boolean;
  message?: string;
  details?: Record<string, unknown>;
};

type HealthResponse = {
  status: string;
  timestamp: string;
  checks: {
    env: HealthCheck;
    dataDir: HealthCheck;
    database: HealthCheck;
  };
};

const HealthPage = () => {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await httpRequest<HealthResponse>("/api/health");
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  return (
    <div className="app-shell">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Health монитор</h1>
        <p>Показывает состояние окружения, доступа к файлам и файловой БД.</p>
        <button className="button" onClick={runCheck} disabled={loading}>
          {loading ? "Проверяем..." : "Обновить"}
        </button>
      </div>
      {error && (
        <div className="card" style={{ background: "#fee2e2" }}>
          <strong>Ошибка запроса</strong>
          <p>{error}</p>
        </div>
      )}
      {data && (
        <div className="card">
          <h2>Статус: {data.status === "ok" ? "✅ ok" : "⚠️ degraded"}</h2>
          <p>Обновлено: {new Date(data.timestamp).toLocaleString()}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {Object.entries(data.checks).map(([key, check]) => (
              <li key={key} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>
                  {key}: {check.ok ? "✅" : "❌"}
                </strong>
                {check.message && <p style={{ margin: 0 }}>{check.message}</p>}
                {check.details && (
                  <pre
                    style={{
                      background: "#f8fafc",
                      padding: 10,
                      borderRadius: 8,
                      overflowX: "auto",
                      marginTop: 8,
                    }}
                  >
                    {JSON.stringify(check.details, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HealthPage;


