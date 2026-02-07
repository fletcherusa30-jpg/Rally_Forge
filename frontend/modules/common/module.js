export const createStepIndicator = (totalSteps) => {
  const wrapper = document.createElement("div");
  wrapper.className = "rf-step";
  wrapper.dataset.totalSteps = String(totalSteps);

  wrapper.innerHTML = `
    <div class="rf-step-track">
      <span class="rf-step-bar" data-step-bar></span>
    </div>
    <span data-step-label>Step 1 of ${totalSteps}</span>
  `;

  return wrapper;
};

export const updateStepIndicator = (container, stepIndex) => {
  const totalSteps = Number(container.dataset.totalSteps || 1);
  const bar = container.querySelector("[data-step-bar]");
  const label = container.querySelector("[data-step-label]");
  const percent = ((stepIndex + 1) / totalSteps) * 100;

  if (bar) {
    bar.style.width = `${percent}%`;
  }

  if (label) {
    label.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
  }
};
