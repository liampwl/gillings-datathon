'use strict';

const express = require('express');
const path = require('path');
const coefficients = require('../model/coefficients.json');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * Logistic regression sigmoid function.
 * @param {number} z - Linear combination of inputs and coefficients.
 * @returns {number} Probability between 0 and 1.
 */
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Parse a boolean-like value (true, 'true', 1) to 0 or 1.
 * @param {*} value - Input value.
 * @returns {number} 1 if truthy boolean, 0 otherwise.
 */
function parseBooleanInput(value) {
  return value === true || value === 'true' || value === 1 ? 1 : 0;
}

/**
 * Determine risk category from probability.
 * @param {number} probability - Value between 0 and 1.
 * @returns {string} 'Low', 'Moderate', or 'High'.
 */
function getRiskCategory(probability) {
  if (probability < 0.3) return 'Low';
  if (probability < 0.6) return 'Moderate';
  return 'High';
}

/**
 * POST /predict
 * Body: { age, bmi, hypertension, physicalActivity, sleepHours }
 * Returns: { probability, riskCategory }
 */
app.post('/predict', (req, res) => {
  const { age, bmi, hypertension, physicalActivity, sleepHours } = req.body;

  // Validate inputs
  if (
    age === undefined || bmi === undefined ||
    hypertension === undefined || physicalActivity === undefined ||
    sleepHours === undefined
  ) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const ageNum = parseFloat(age);
  const bmiNum = parseFloat(bmi);
  const hypertensionNum = parseBooleanInput(hypertension);
  const physicalActivityNum = parseBooleanInput(physicalActivity);
  const sleepNum = parseFloat(sleepHours);

  const invalidFields = [];
  if (isNaN(ageNum)) invalidFields.push('age');
  if (isNaN(bmiNum)) invalidFields.push('bmi');
  if (isNaN(sleepNum)) invalidFields.push('sleepHours');
  if (invalidFields.length > 0) {
    return res.status(400).json({ error: `The following fields must be numeric: ${invalidFields.join(', ')}.` });
  }

  const z =
    coefficients.intercept +
    coefficients.age * ageNum +
    coefficients.bmi * bmiNum +
    coefficients.hypertension * hypertensionNum +
    coefficients.physicalActivity * physicalActivityNum +
    coefficients.sleepHours * sleepNum;

  const probability = sigmoid(z);
  const riskCategory = getRiskCategory(probability);

  res.json({ probability: parseFloat(probability.toFixed(4)), riskCategory });
});

app.listen(PORT, () => {
  console.log(`Diabetes risk screening app running at http://localhost:${PORT}`);
});
