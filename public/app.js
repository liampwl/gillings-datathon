'use strict';

const form = document.getElementById('riskForm');
const resultDiv = document.getElementById('result');
const probabilityEl = document.getElementById('probability');
const riskCategoryEl = document.getElementById('riskCategory');
const errorDiv = document.getElementById('error');

const RISK_CLASSES = ['risk-low', 'risk-moderate', 'risk-high'];

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Clear previous results
  resultDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  RISK_CLASSES.forEach((cls) => resultDiv.classList.remove(cls));

  const age = parseFloat(document.getElementById('age').value);
  const bmi = parseFloat(document.getElementById('bmi').value);
  const sleepHours = parseFloat(document.getElementById('sleepHours').value);
  const hypertensionEl = document.querySelector('input[name="hypertension"]:checked');
  const physicalActivityEl = document.querySelector('input[name="physicalActivity"]:checked');

  if (!hypertensionEl || !physicalActivityEl) {
    showError('Please answer all questions before submitting.');
    return;
  }

  const payload = {
    age,
    bmi,
    hypertension: hypertensionEl.value,
    physicalActivity: physicalActivityEl.value,
    sleepHours,
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const response = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'An error occurred. Please try again.');
      return;
    }

    const probabilityPercent = (data.probability * 100).toFixed(1);
    probabilityEl.textContent = `${probabilityPercent}%`;
    riskCategoryEl.textContent = data.riskCategory;

    const riskClass = `risk-${data.riskCategory.toLowerCase()}`;
    resultDiv.classList.add(riskClass);
    resultDiv.classList.remove('hidden');
  } catch (err) {
    showError('Could not connect to the server. Please ensure the app is running.');
  } finally {
    submitBtn.disabled = false;
  }
});

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
}
