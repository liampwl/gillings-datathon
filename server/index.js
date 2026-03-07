'use strict';

const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper to load coefficients dynamically so hot-reloads work
function getCoefficients() {
  const filePath = path.join(__dirname, '..', 'model', 'coefficients.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Logistic regression sigmoid function.
 * @param {number} z - Linear combination of inputs and coefficients.
 * @returns {number} Probability between 0 and 1.
 */
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Parse a value to a number.
 * Handles booleans ("true"/"false"/true/false) → 0 or 1,
 * and numeric strings/numbers → parseFloat.
 * @param {*} value
 * @returns {number|NaN}
 */
function toNumeric(value) {
  if (value === true || value === 'true') return 1;
  if (value === false || value === 'false') return 0;
  return parseFloat(value);
}

/**
 * Determine risk category from probability.
 * @param {number} probability - Value between 0 and 1.
 * @returns {string} 'Low', 'Moderate', or 'High'.
 */
function getRiskCategory(probability) {
  if (probability < 0.20) return 'Low';
  if (probability < 0.78) return 'Moderate';
  return 'High';
}

/**
 * GET /coefficients
 * Returns the model coefficients for the explainability panel.
 */
app.get('/coefficients', (req, res) => {
  res.json(getCoefficients());
});

/**
 * POST /predict
 *
 * Dynamically reads whatever feature keys exist in coefficients.json
 * (excluding "intercept") and expects them in the request body.
 *
 * This means your modeling team can add or remove features simply by
 * editing model/coefficients.json — no server code changes needed.
 *
 * Body example: { age: 52, bmi: 31.2, hypertension: "true", ... }
 * Returns:      { probability: 0.398, riskCategory: "Moderate" }
 */
app.post('/predict', (req, res) => {
  const body = req.body;
  const coeffs = getCoefficients();

  // Identify which features the model expects (everything except "intercept")
  const featureKeys = Object.keys(coeffs).filter((k) => k !== 'intercept');

  // Check for missing fields
  const missing = featureKeys.filter((k) => body[k] === undefined);
  if (missing.length > 0) {
    return res
      .status(400)
      .json({ error: `Missing required fields: ${missing.join(', ')}.` });
  }

  // Convert all inputs to numeric values and validate
  const values = {};
  const invalidFields = [];
  for (const key of featureKeys) {
    const num = toNumeric(body[key]);
    if (isNaN(num)) {
      invalidFields.push(key);
    } else {
      values[key] = num;
    }
  }

  if (invalidFields.length > 0) {
    return res
      .status(400)
      .json({ error: `The following fields must be numeric or boolean: ${invalidFields.join(', ')}.` });
  }

  // Compute z = intercept + Σ(coefficient_i × value_i)
  let z = coeffs.intercept || 0;
  for (const key of featureKeys) {
    z += coeffs[key] * values[key];
  }

  const probability = sigmoid(z);
  const riskCategory = getRiskCategory(probability);

  res.json({ probability: parseFloat(probability.toFixed(4)), riskCategory });
});

/**
 * ============================================================================
 * 🌲 RANDOM FOREST (ENSEMBLE) IN JAVASCRIPT
 * ============================================================================
 * DORMANT / UNUSED FOR NOW, BUT FULLY IMPLEMENTED FOR FUTURE PHASES.
 * 
 * Yes, you can run Random Forests entirely natively in Javascript! 
 * Scikit-learn (Python) models can easily be exported to JSON and traversed in 
 * Node.js without any heavyweight Python servers. Below is the tree-traversal architecture.
 */

class RandomForestClassifier {
  constructor(treesJson) {
    this.trees = treesJson; // Array of decision tree objects
  }

  // Traverse a single decision tree
  traverseTree(node, features) {
    if (node.isLeaf) {
      return node.probability;
    }
    const val = features[node.feature];
    if (val <= node.threshold) {
      return this.traverseTree(node.left, features);
    } else {
      return this.traverseTree(node.right, features);
    }
  }

  // Ensemble prediction: Average probabilities across all trees in the forest
  predict(features) {
    if (!this.trees || this.trees.length === 0) return 0;

    let sumProb = 0;
    for (const tree of this.trees) {
      sumProb += this.traverseTree(tree, features);
    }
    return sumProb / this.trees.length; // Average probability ensemble
  }
}

/**
 * POST /predict-rf (Dormant Endpoint)
 * 
 * Placeholder endpoint to show how we easily transition from Logistic Regression
 * to a Random Forest simply by pointing to a different JSON model architecture.
 */
app.post('/predict-rf', (req, res) => {
  const body = req.body;

  // In reality, this would read `model/rf_trees.json` exported from Python
  const DUMMY_TREES = [];

  const rfModel = new RandomForestClassifier(DUMMY_TREES);

  // Parse inputs (same mapping validation as logistic regression)
  const coeffs = getCoefficients();
  const featureKeys = Object.keys(coeffs).filter((k) => k !== 'intercept');
  const values = {};
  for (const key of featureKeys) {
    values[key] = toNumeric(body[key]);
  }

  // Predict probability via JS ensemble averaging
  const probability = rfModel.predict(values);
  const riskCategory = getRiskCategory(probability);

  res.json({
    model: "Random Forest",
    probability: parseFloat(probability.toFixed(4)),
    riskCategory
  });
});
// ============================================================================

/**
 * Helper: HTTPS GET that returns parsed JSON (works on Node 16+, no fetch needed).
 */
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'DiabetesIQ-DatathonDemo/1.0' } }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from HRSA API')); }
      });
    }).on('error', reject);
  });
}

/**
 * GET /sdoh?zip=27514
 * 
 * Simulated endpoint for Social Determinants of Health (SDoH).
 * In a real app, this would query the CDC SVI or Area Deprivation Index (ADI) APIs.
 * For this Datathon prototype, we deterministically mock a vulnerability score based on the ZIP string.
 */
app.get('/sdoh', (req, res) => {
  const zip = (req.query.zip || '').trim();
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Valid ZIP required' });
  }

  // Create a pseudo-random vulnerability score between 0 and 1 based on the ZIP code characters
  let hash = 0;
  for (let i = 0; i < zip.length; i++) {
    hash = ((hash << 5) - hash) + zip.charCodeAt(i);
    hash |= 0;
  }

  // Normalize to 0.0 - 1.0 (some ZIPs will be high, some low)
  const score = Math.abs(Math.sin(hash));

  // Let's say any score > 0.6 is considered "High Vulnerability" (e.g. food desert, low transport access)
  const isHighVulnerability = score > 0.6;

  res.json({
    zip,
    sviScore: parseFloat(score.toFixed(2)),
    isHighVulnerability
  });
});

/**
 * GET /nearby-clinics?zip=27514&radius=10
 *
 * Proxies the HRSA Health Center Finder API to locate nearby
 * Federally Qualified Health Centers (FQHCs). No API key required.
 * Two-step flow: geocode the ZIP → search for clinics near coords.
 */
app.get('/nearby-clinics', async (req, res) => {
  const zip = (req.query.zip || '').trim();
  const radius = parseInt(req.query.radius, 10) || 20;

  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'Please enter a valid 5-digit ZIP code.' });
  }

  try {
    // Step 1: Geocode the ZIP code
    const geoData = await httpsGetJson(
      `https://data.hrsa.gov/HDWLocatorApi/Geo/Geocode?text=${zip}`
    );
    if (!geoData.issuccessful) {
      return res.status(400).json({ error: 'Could not locate that ZIP code. Please try another.' });
    }

    // Step 2: Find nearby health centers
    const centers = await httpsGetJson(
      `https://data.hrsa.gov/HDWLocatorApi/healthcenters/find?lon=${geoData.longitude}&lat=${geoData.latitude}&radius=${radius}`
    );

    // Deduplicate by name + address and return the 5 closest
    const seen = new Set();
    const results = [];
    for (const c of centers) {
      const key = `${c.CtrNm}|${c.CtrAddress}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name: c.CtrNm,
        address: `${c.CtrAddress}, ${c.CtrCity}, ${c.CtrStateAbbr} ${c.CtrZipCd}`,
        phone: c.CtrPhoneNum || null,
        website: c.SiteUrl || c.UrlTxt || null,
        distance: c.Distance,
        parent: c.ParentCtrNm || null,
      });
      if (results.length >= 5) break;
    }

    res.json({ zip, radius, count: results.length, centers: results });
  } catch (err) {
    console.error('HRSA API error:', err.message);
    res.status(502).json({ error: 'Unable to reach the health center directory right now. Please try again later.' });
  }
});

app.listen(PORT, () => {
  console.log(`Diabetes risk screening app running at http://localhost:${PORT}`);
});

module.exports = app;
