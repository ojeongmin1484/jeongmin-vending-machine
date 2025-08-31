// src/components/VendingMachine.tsx
import React, { useMemo, useState } from "react";

type Drink = "cola" | "water" | "coffee";
type PaymentMethod = "card" | "cash" | null;
type Denom = 100 | 500 | 1000 | 5000 | 10000;

const PRICES: Record<Drink, number> = {
  cola: 1100,
  water: 600,
  coffee: 700,
};

const INITIAL_STOCK: Record<Drink, number> = {
  cola: 5,
  water: 5,
  coffee: 5,
};

const DENOMS: readonly Denom[] = [100, 500, 1000, 5000, 10000];

export default function VendingMachine() {
  // ---- 상태 ----
  const [state, setState] =
    useState<"Idle" | "PaymentPending" | "Checking" | "Dispensing" | "Completed" | "Error">("Idle");
  const [method, setMethod] = useState<PaymentMethod>(null); // 하나만 선택 가능
  const [stock, setStock] = useState<Record<Drink, number>>({ ...INITIAL_STOCK });

  // 현금 잔액
  const [selectedDenom, setSelectedDenom] = useState<Denom>(1000);
  const [insertedTotal, setInsertedTotal] = useState<number>(0);

  // 알림/상태 표시
  const [message, setMessage] = useState<string>("");

  // 명시적 카드 오류 토글
  const [cardError, setCardError] = useState<boolean>(false);

  // 금액 포맷
  const won = (n: number) => n.toLocaleString("ko-KR") + "원";

  // 결제 방식 선택(한 번 정하면 다른 방식 비활성화)
  const onCardTag = () => {
    if (method && method !== "card") {
      alert("이미 현금을 선택했습니다. (하나의 입력만 허용)");
      return;
    }
    setMethod("card");
    setState((s) => (s === "Idle" ? "PaymentPending" : s));
    setMessage("카드가 태그되었습니다.");
  };

  const onCashSelect = (d: Denom) => {
    if (method && method !== "cash") {
      alert("이미 카드를 선택했습니다. (하나의 입력만 허용)");
      return;
    }
    setMethod("cash");
    setState((s) => (s === "Idle" ? "PaymentPending" : s));
    setSelectedDenom(d);
  };

  // 선택된 권종 1장 투입
  const onInsertCash = () => {
    if (method && method !== "cash") {
      alert("이미 카드를 선택했습니다. (하나의 입력만 허용)");
      return;
    }
    setMethod("cash");
    setState((s) => (s === "Idle" ? "PaymentPending" : s));
    setInsertedTotal((t) => {
      const add = selectedDenom; // 1장
      const next = t + add;
      setMessage(`현금 투입: ${won(add)} · 잔액 ${won(next)}`);
      return next;
    });
  };

  const resetAll = () => {
    setState("Idle");
    setMethod(null);
    setSelectedDenom(1000);
    setInsertedTotal(0);
    setMessage("");
    setCardError(false);
  };

  // 상품 목록
  const drinks = useMemo(
    () =>
      [
        { key: "cola", label: "콜라", price: PRICES.cola },
        { key: "water", label: "물", price: PRICES.water },
        { key: "coffee", label: "커피", price: PRICES.coffee },
      ] as const,
    []
  );

  // 거스름돈 반환
  const onReturnChange = () => {
    if (method !== "cash" || insertedTotal <= 0) {
      alert("반환할 거스름돈이 없습니다.");
      return;
    }
    const amount = insertedTotal;
    setState("Dispensing");
    setMessage(`거스름돈 ${won(amount)}을 반환합니다...`);
    setTimeout(() => {
      alert(`거스름돈: ${won(amount)}`);
      resetAll(); // 세션 종료
    }, 500);
  };

  // 결제 로직
  const handleBuy = async (drink: Drink) => {
    if (!method) {
      alert("결제 방식을 먼저 선택하세요. (카드 태그 또는 현금 투입)");
      return;
    }

    setState("Checking");
    setMessage(`${drink} 재고/결제 검증 중...`);

    // 재고 체크
    if (!stock[drink] || stock[drink] <= 0) {
      setState("Error");
      setMessage("해당 음료가 없습니다.");
      alert("해당 음료가 없습니다.");
      setState("PaymentPending"); // 세션 유지
      return;
    }

    const price = PRICES[drink];

    if (method === "card") {
      // ★ 랜덤 없이 명시적 오류만 체크
      if (cardError) {
        setState("Error");
        setMessage("결제에 실패하였습니다. (카드사 오류)");
        alert("결제에 실패하였습니다. (카드사 오류)");
        setTimeout(resetAll, 800);
        return;
      }
      await dispense(drink);
      setState("Completed");
      setTimeout(resetAll, 800); // 카드 결제는 1회성 세션 종료
      return;
    }

    // 현금 결제
    if (insertedTotal < price) {
      setState("Error");
      setMessage(`잔액 부족: ${won(insertedTotal)} / 필요 금액 ${won(price)}`);
      alert("잔액이 부족합니다. 금액을 더 투입하세요.");
      setState("PaymentPending"); // 세션 유지
      return;
    }

    // 잔액 차감 + 배출
    setInsertedTotal((t) => {
      const next = t - price;
      setMessage(`결제 완료! 남은 잔액 ${won(next)} · 계속 주문하거나 '거스름돈'으로 반환하세요.`);
      return next;
    });
    await dispense(drink);
    setState("PaymentPending"); // 현금 세션 유지
  };

  // 배출
  const dispense = async (drink: Drink) => {
    setState("Dispensing");
    setMessage(`${drink} 배출 중...`);
    await new Promise((r) => setTimeout(r, 600)); // 배출 지연 시뮬

    // 재고 차감 (음수 방지)
    setStock((s) => {
      const next = Math.max(0, s[drink] - 1);
      return { ...s, [drink]: next };
    });

    alert(`${drink}가 나왔습니다.`);
  };

  const disabledBecauseChosenOther = (target: PaymentMethod) =>
    method !== null && method !== target;

  const isBusy = state === "Checking" || state === "Dispensing";
  const canReturnChange = method === "cash" && insertedTotal > 0 && !isBusy;

  // --- 최소 사각형 UI ---
  const ui = {
    page: {
      margin: "16px auto",
      padding: 16,
      maxWidth: 960,
      fontFamily: "system-ui, sans-serif",
      background: "#f7f7f7",
    } as React.CSSProperties,
    grid: {
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: 12,
    } as React.CSSProperties,
    box: {
      background: "#fff",
      border: "1px solid #dcdcdc",
      borderRadius: 4,
      padding: 12,
    } as React.CSSProperties,
    titleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    } as React.CSSProperties,
    subtle: { color: "#666", fontSize: 13 } as React.CSSProperties,
    productGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 8,
    } as React.CSSProperties,
    productBtn: (disabled: boolean) =>
      ({
        background: "#fff",
        border: "1px solid #dcdcdc",
        borderRadius: 4,
        padding: "12px 10px",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#999" : "#111",
      } as React.CSSProperties),
    row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } as React.CSSProperties,
    grow: { marginLeft: "auto" } as React.CSSProperties,
    btn: (enabled = true) =>
      ({
        background: "#fff",
        border: "1px solid #dcdcdc",
        borderRadius: 4,
        padding: "8px 10px",
        cursor: enabled ? "pointer" : "not-allowed",
      } as React.CSSProperties),
    radio: (disabled: boolean) =>
      ({
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid #dcdcdc",
        borderRadius: 4,
        padding: "6px 8px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: "#fff",
      } as React.CSSProperties),
    display: {
      background: "#fff",
      border: "1px solid #dcdcdc",
      borderRadius: 4,
      padding: 10,
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    } as React.CSSProperties,
    divider: {
      height: 1,
      background: "#eee",
      margin: "8px 0",
      border: "none",
    } as React.CSSProperties,
  };

  return (
    <div style={ui.page}>
      <div style={{ ...ui.titleRow, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>자판기</h2>
        <div style={ui.subtle}>상태: <b>{state}</b></div>
      </div>

      <div style={ui.grid}>
        {/* 좌측: 상품 */}
        <div style={ui.box}>
          <div style={{ ...ui.titleRow, marginBottom: 8 }}>
            <strong>상품 선택</strong>
            <span style={ui.subtle}>재고/가격</span>
          </div>
          <div style={ui.productGrid}>
            {drinks.map((d) => {
              const count = stock[d.key];
              const disabled = isBusy || count <= 0;
              return (
                <button
                  key={d.key}
                  onClick={() => handleBuy(d.key)}
                  disabled={disabled}
                  style={ui.productBtn(disabled)}
                >
                  <div style={{ fontWeight: 700 }}>{d.label}</div>
                  <div style={{ fontSize: 13, color: "#444" }}>
                    {won(d.price)} · 재고 {count}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측: 패널 */}
        <div style={ui.box}>
          {/* 표시창 */}
          <div style={ui.display}>
            <div style={{ color: "#333" }}>
              {message || "카드를 태그하거나 현금을 투입하세요."}
            </div>
            <div className="balance" style={{ ...ui.grow, textAlign: "right" }}>
              잔액: <b>{won(insertedTotal)}</b>
            </div>
          </div>

          {/* 카드 */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 6 }}><strong>카드 결제</strong></div>
            <button
              onClick={onCardTag}
              disabled={disabledBecauseChosenOther("card") || isBusy}
              style={ui.btn(!(disabledBecauseChosenOther("card") || isBusy))}
              title="카드를 단말기에 태그"
            >
              카드 태그
            </button>
            {method === "card" && <span style={{ marginLeft: 8, ...ui.subtle }}>(선택됨)</span>}

            {/* 카드 오류 조건 토글 */}
            <label style={{ marginLeft: 12, ...ui.subtle }}>
              <input
                type="checkbox"
                checked={cardError}
                onChange={(e) => setCardError(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              카드사 오류(시뮬레이션)
            </label>
          </div>

          <hr style={ui.divider} />

          {/* 현금 */}
          <div>
            <div style={{ marginBottom: 6 }}><strong>현금 결제</strong></div>
            <div style={{ ...ui.subtle, marginBottom: 6 }}>
              사용 가능 권종: 100 / 500 / 1,000 / 5,000 / 10,000원
            </div>

            <div style={{ ...ui.row, marginBottom: 8 }}>
              {DENOMS.map((d) => (
                <label key={d} style={ui.radio(disabledBecauseChosenOther("cash") || isBusy)}>
                  <input
                    type="radio"
                    name="denom"
                    value={d}
                    checked={selectedDenom === d}
                    onChange={() => onCashSelect(d)}
                    disabled={disabledBecauseChosenOther("cash") || isBusy}
                  />
                  {d.toLocaleString()}원
                </label>
              ))}
            </div>

            <div style={ui.row}>
              <button
                onClick={onInsertCash}
                disabled={disabledBecauseChosenOther("cash") || isBusy}
                style={ui.btn(!(disabledBecauseChosenOther("cash") || isBusy))}
              >
                투입 (1장)
              </button>
              <div style={{ ...ui.grow, textAlign: "right", color: "#333" }}>
                현재 잔액: <b>{won(insertedTotal)}</b>
              </div>
            </div>
          </div>

          <hr style={ui.divider} />

          {/* 하단 유틸 */}
          <div style={{ ...ui.row, justifyContent: "space-between" }}>
            <button
              onClick={resetAll}
              disabled={isBusy}
              style={ui.btn(!isBusy)}
              title="세션 초기화"
            >
              초기화
            </button>
            <button
              onClick={onReturnChange}
              disabled={!canReturnChange}
              style={ui.btn(canReturnChange)}
              title={canReturnChange ? "남은 잔액을 반환합니다." : "반환할 잔액이 없어요"}
            >
              거스름돈 반환
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
