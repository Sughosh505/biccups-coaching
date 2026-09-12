// The consultation pipeline timeline — DESIGN.md §4 Pipeline.
// Every step states its own date, so "done" is never carried by colour alone (§8).

export type PipelineStep = {
  label: string;
  /** Shown under the label once the step is done. Null renders "Not yet". */
  date: string | null;
  done: boolean;
};

export function ConsultationPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex flex-col px-4 py-3.5">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;

        return (
          <div key={step.label} className="flex items-start gap-[11px]">
            <span className="flex flex-col items-center gap-0.5">
              <span
                className={`mt-1 h-[9px] w-[9px] rounded-full ${
                  step.done ? "bg-accent" : "border-[1.5px] border-border-strong bg-surface"
                }`}
              />
              {last ? null : <span className="h-[30px] w-[1.5px] bg-border" />}
            </span>

            <span className="flex flex-col gap-0.5">
              <span
                className={
                  step.done ? "text-[12.5px] font-medium text-ink" : "text-[12.5px] text-muted-2"
                }
              >
                {step.label}
              </span>
              <span className={step.done ? "tnum text-[11.5px] text-muted-2" : "text-[11.5px] text-faint"}>
                {step.done ? (step.date ?? "Done") : "Not yet"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
