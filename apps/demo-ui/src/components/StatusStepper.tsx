import React from "react";

export type StepState = "upcoming" | "current" | "completed" | "error" | "skipped";

export interface StepItem {
  id: string;
  label: string;
  timestamp?: string | null;
  state: StepState;
  tooltip?: string;
}

interface StatusStepperProps {
  steps: StepItem[];
}

export function StatusStepper({ steps }: StatusStepperProps) {
  return (
    <div className="status-stepper" role="region" aria-label="Mail progress steps">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className={`stepper-step stepper-step--${step.state}`} title={step.tooltip}>
              <div className="stepper-node">
                {step.state === "completed" ? (
                  <span className="stepper-icon">✓</span>
                ) : step.state === "error" ? (
                  <span className="stepper-icon">✕</span>
                ) : step.state === "skipped" ? (
                  <span className="stepper-icon">–</span>
                ) : (
                  <span className="stepper-number">{index + 1}</span>
                )}
              </div>
              <div className="stepper-content">
                <span className="stepper-label">{step.label}</span>
                {step.timestamp && (
                  <span className="stepper-time">
                    {new Date(step.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>

            {!isLast && (
              <div
                className={`stepper-connector ${
                  step.state === "completed" ? "stepper-connector--active" : ""
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
