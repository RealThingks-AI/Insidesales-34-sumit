import { useState } from "react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const currentValue = previousValue || 0;
      let result: number;

      switch (operator) {
        case "+":
          result = currentValue + inputValue;
          break;
        case "-":
          result = currentValue - inputValue;
          break;
        case "×":
          result = currentValue * inputValue;
          break;
        case "÷":
          result = currentValue / inputValue;
          break;
        default:
          result = inputValue;
      }

      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = () => {
    if (!operator || previousValue === null) return;

    const inputValue = parseFloat(display);
    let result: number;

    switch (operator) {
      case "+":
        result = previousValue + inputValue;
        break;
      case "-":
        result = previousValue - inputValue;
        break;
      case "×":
        result = previousValue * inputValue;
        break;
      case "÷":
        result = previousValue / inputValue;
        break;
      default:
        return;
    }

    setDisplay(String(result));
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const toggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const percentage = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

  const CalcButton = ({
    children,
    onClick,
    variant = "default",
    className = "",
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "operator" | "function";
    className?: string;
  }) => {
    const baseStyles = "h-16 w-16 text-xl font-medium rounded-full transition-all duration-200 hover:scale-105";
    const variantStyles = {
      default: "bg-muted text-foreground hover:bg-muted/80",
      operator: "bg-primary text-primary-foreground hover:bg-primary/90",
      function: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    };

    return (
      <Button
        onClick={onClick}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      >
        {children}
      </Button>
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-xs rounded-3xl bg-card p-6 shadow-2xl">
        {/* Display */}
        <div className="mb-6 flex h-24 items-end justify-end rounded-2xl bg-muted/50 px-4 py-3">
          <span className="text-4xl font-light text-foreground truncate">
            {display.length > 12 ? parseFloat(display).toExponential(5) : display}
          </span>
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <CalcButton onClick={clear} variant="function">
            AC
          </CalcButton>
          <CalcButton onClick={toggleSign} variant="function">
            ±
          </CalcButton>
          <CalcButton onClick={percentage} variant="function">
            %
          </CalcButton>
          <CalcButton onClick={() => performOperation("÷")} variant="operator">
            ÷
          </CalcButton>

          {/* Row 2 */}
          <CalcButton onClick={() => inputDigit("7")}>7</CalcButton>
          <CalcButton onClick={() => inputDigit("8")}>8</CalcButton>
          <CalcButton onClick={() => inputDigit("9")}>9</CalcButton>
          <CalcButton onClick={() => performOperation("×")} variant="operator">
            ×
          </CalcButton>

          {/* Row 3 */}
          <CalcButton onClick={() => inputDigit("4")}>4</CalcButton>
          <CalcButton onClick={() => inputDigit("5")}>5</CalcButton>
          <CalcButton onClick={() => inputDigit("6")}>6</CalcButton>
          <CalcButton onClick={() => performOperation("-")} variant="operator">
            −
          </CalcButton>

          {/* Row 4 */}
          <CalcButton onClick={() => inputDigit("1")}>1</CalcButton>
          <CalcButton onClick={() => inputDigit("2")}>2</CalcButton>
          <CalcButton onClick={() => inputDigit("3")}>3</CalcButton>
          <CalcButton onClick={() => performOperation("+")} variant="operator">
            +
          </CalcButton>

          {/* Row 5 */}
          <CalcButton
            onClick={() => inputDigit("0")}
            className="col-span-2 w-full"
          >
            0
          </CalcButton>
          <CalcButton onClick={inputDecimal}>.</CalcButton>
          <CalcButton onClick={calculate} variant="operator">
            =
          </CalcButton>
        </div>
      </div>
    </div>
  );
};

export default Index;
