'use strict';

const form = document.getElementById('riskForm');
const resultDiv = document.getElementById('result');
const riskCategoryEl = document.getElementById('riskCategory');
const riskBadge = document.getElementById('riskBadge');
const riskDot = document.getElementById('riskDot');
const errorDiv = document.getElementById('error');
const errorText = document.getElementById('errorText');
const gaugeValue = document.getElementById('gaugeValue');
const gaugeFill = document.getElementById('gaugeFill');
const explainBars = document.getElementById('explainBars');
const bmiValueEl = document.getElementById('bmiValue');
const bmiPreview = document.getElementById('bmiPreview');
const insightsDiv = document.getElementById('insights');
const insightsSummary = document.getElementById('insightsSummary');
const insightsCards = document.getElementById('insightsCards');
const insightsResourcesList = document.getElementById('insightsResourcesList');

const whatIfCard = document.getElementById('whatIfCard');
const whatIfControls = document.getElementById('whatIfControls');
const whatIfProbValue = document.getElementById('whatIfProbValue');
const whatIfRiskBadge = document.getElementById('whatIfRiskBadge');

const thankYouCard = document.getElementById('thankYouCard');
const showScoreConsentCheckbox = document.getElementById('showScoreConsent');
const submitBtnSpan = document.querySelector('#submitBtn span');

const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.querySelector('.sun-icon');
const moonIcon = document.querySelector('.moon-icon');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
}

// Initialize theme
const savedTheme = localStorage.getItem('theme');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme) {
  setTheme(savedTheme);
} else if (systemPrefersDark) {
  setTheme('dark');
} else {
  setTheme('light');
}

themeToggle?.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

const RISK_CLASSES = ['risk-badge--low', 'risk-badge--moderate', 'risk-badge--high'];

/** Shared coefficients cache — fetched once, used by both explainability bars and insights */
let _cachedCoefficients = null;
async function getCoefficients() {
  if (_cachedCoefficients) return _cachedCoefficients;
  try {
    const res = await fetch('/coefficients');
    if (res.ok) {
      _cachedCoefficients = await res.json();
    }
  } catch (e) { /* silent */ }
  return _cachedCoefficients;
}

/**
 * Human-readable labels for coefficient keys.
 * Add entries here when you add new features to coefficients.json.
 * Any key not listed here will be displayed with auto-formatting
 * (e.g. "physicalActivity" → "Physical Activity").
 */
const FEATURE_LABELS = {
  age: 'Age',
  bmi: 'BMI',
  hypertension: 'Hypertension',
  physicalActivity: 'Physical Activity',
  sleepHours: 'Sleep Hours',
  highChol: 'High Cholesterol',
  genHlth: 'General Health',
  heartDiseaseOrAttack: 'Heart Disease',
  hvyAlcoholConsump: 'Heavy Alcohol Use',
  smoker: 'Smoker',
  stroke: 'Stroke',
  fruits: 'Fruit Consumption',
  veggies: 'Veggie Consumption',
  diffWalk: 'Difficulty Walking',
  sex: 'Sex',
  income: 'Income',
  education: 'Education',
  mentHlth: 'Mental Health Days',
  physHlth: 'Physical Health Days',
};

/**
 * Auto-format a camelCase key into a readable label.
 * e.g. "physicalActivity" → "Physical Activity"
 */
function autoLabel(key) {
  if (FEATURE_LABELS[key]) return FEATURE_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/* ─── BMI Calculation ─── */

/**
 * Compute BMI from US units: BMI = (weight_lbs × 703) / (height_inches²)
 */
function computeBMI(weightLbs, heightFt, heightIn) {
  const totalInches = heightFt * 12 + heightIn;
  if (totalInches <= 0 || weightLbs <= 0) return null;
  return (weightLbs * 703) / (totalInches * totalInches);
}

/**
 * Live-update the BMI preview chip whenever height or weight changes.
 */
function updateBMIPreview() {
  const w = parseFloat(document.getElementById('weightLbs').value);
  const ft = parseFloat(document.getElementById('heightFt').value);
  const inches = parseFloat(document.getElementById('heightIn').value) || 0;

  if (!isNaN(w) && !isNaN(ft) && w > 0 && ft > 0) {
    const bmi = computeBMI(w, ft, inches);
    if (bmi !== null && isFinite(bmi)) {
      bmiValueEl.textContent = bmi.toFixed(1);
      bmiPreview.classList.add('bmi-preview--active');
      return;
    }
  }

  bmiValueEl.textContent = '—';
  bmiPreview.classList.remove('bmi-preview--active');
}

// Attach live listeners
['weightLbs', 'heightFt', 'heightIn'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateBMIPreview);
    el.addEventListener('change', updateBMIPreview);
  }
});

/* ─── Form Submission & Consent UI ─── */

function updateSubmitButtonLabel() {
  if (!submitBtnSpan) return;
  submitBtnSpan.textContent = showScoreConsentCheckbox && showScoreConsentCheckbox.checked
    ? 'Yes, Show My Health Profile'
    : 'Submit Anonymized Data';
}

if (showScoreConsentCheckbox) {
  showScoreConsentCheckbox.addEventListener('change', updateSubmitButtonLabel);
}

updateSubmitButtonLabel();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Clear previous
  resultDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  insightsDiv.classList.add('hidden');
  whatIfCard.classList.add('hidden');
  thankYouCard.classList.add('hidden');
  RISK_CLASSES.forEach((cls) => riskBadge.classList.remove(cls));

  // Clear previous highlights
  document.querySelectorAll('.error-highlight').forEach((el) => el.classList.remove('error-highlight'));

  // Gather inputs
  const age = parseFloat(document.getElementById('age').value);
  const weightLbs = parseFloat(document.getElementById('weightLbs').value);
  const heightFt = parseFloat(document.getElementById('heightFt').value);
  const heightIn = parseFloat(document.getElementById('heightIn').value) || 0;
  const sleepHours = parseFloat(document.getElementById('sleepHours').value);

  // Calculate BMI
  const bmi = computeBMI(weightLbs, heightFt, heightIn);
  if (bmi === null || !isFinite(bmi)) {
    showError('Please enter valid height and weight to calculate BMI.');
    return;
  }

  // Radio buttons — gather all that exist
  const radioNames = [
    'HighBP', 'HighChol', 'CholCheck', 'Smoker',
    'Stroke', 'HeartDiseaseorAttack', 'PhysActivity',
    'Fruits', 'Veggies', 'HvyAlcoholConsump', 'AnyHealthcare'
  ];
  const zipCode = document.getElementById('zipCode').value.trim();

  const payload = {
    age,
    bmi: parseFloat(bmi.toFixed(2)),
    sleepHours,
    zipCode,
  };

  for (const name of radioNames) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    if (!el) {
      showError('Please answer all questions before submitting.');
      const missingInput = document.querySelector(`input[name="${name}"]`);
      if (missingInput) {
        const group = missingInput.closest('.form-group');
        if (group) {
          group.classList.add('error-highlight');
          group.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }
    payload[name] = el.value === 'true' ? 1 : 0;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    // Fire off both API requests in parallel if there's a ZIP code
    const fetchPromises = [
      fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    ];

    if (zipCode && /^\d{5}$/.test(zipCode)) {
      fetchPromises.push(fetch(`/sdoh?zip=${zipCode}`));
    }

    const [predictRes, sdohRes] = await Promise.all(fetchPromises);
    const data = await predictRes.json();

    if (!predictRes.ok) {
      showError(data.error || 'An error occurred. Please try again.');
      return;
    }

    let sdohData = null;
    if (sdohRes && sdohRes.ok) {
      sdohData = await sdohRes.json();
    }

    // Auto-search for nearby clinics if ZIP was perfectly valid
    if (zipCode && /^\d{5}$/.test(zipCode)) {
      clinicZipInput.value = zipCode;
      searchClinics(); // background fire
    }

    // If user did not opt in to seeing their score, only save anonymized data.
    const optedInToSeeScore = showScoreConsentCheckbox && showScoreConsentCheckbox.checked;

    if (!optedInToSeeScore) {
      thankYouCard.classList.remove('hidden');
      return;
    }

    const prob = data.probability;

    // Animate gauge
    animateGauge(prob);

    // Risk category with Deuteranomaly color-blindness accommodation
    riskCategoryEl.innerHTML = data.riskCategory === 'High' ? `<span aria-hidden="true" style="margin-right: 4px;">⚠️</span>High` : data.riskCategory;
    const riskClass = `risk-badge--${data.riskCategory.toLowerCase()}`;
    riskBadge.classList.add(riskClass);

    // Ensure coefficients are loaded before building UI
    await getCoefficients();

    // Build explainability bars
    buildExplainBars(payload);

    // Build health insights panel
    buildInsights(payload, data, sdohData);

    // Build What-If Simulator
    buildWhatIfPanel(payload);

    resultDiv.classList.remove('hidden');
    insightsDiv.classList.remove('hidden');
    whatIfCard.classList.remove('hidden');
  } catch (err) {
    showError('Could not connect to the server. Please ensure the app is running.');
  } finally {
    submitBtn.disabled = false;
  }
});

/* ─── Gauge Animation ─── */

function animateGauge(probability) {
  const ARC_LENGTH = 251.327;
  const targetOffset = ARC_LENGTH * (1 - probability);

  // Reset
  gaugeFill.style.transition = 'none';
  gaugeFill.setAttribute('stroke-dashoffset', ARC_LENGTH);

  // Force reflow then animate
  void gaugeFill.getBoundingClientRect();
  gaugeFill.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)';
  gaugeFill.setAttribute('stroke-dashoffset', targetOffset);

  // Animate counter
  const target = probability * 100;
  const duration = 1000;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    gaugeValue.textContent = `${(target * eased).toFixed(1)}%`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ─── What-If Simulator ─── */

function buildWhatIfPanel(payload) {
  if (!_cachedCoefficients) return;
  whatIfControls.innerHTML = '';
  const currentSimState = { ...payload };

  // Helper to re-run the logistic regression with modified values
  const updateSimResult = () => {
    let logit = _cachedCoefficients.intercept;
    for (const key of Object.keys(currentSimState)) {
      if (_cachedCoefficients[key] !== undefined) {
        let val = currentSimState[key];
        if (val === 'true' || val === true) val = 1;
        if (val === 'false' || val === false) val = 0;
        logit += parseFloat(val) * _cachedCoefficients[key];
      }
    }
    const prob = 1 / (1 + Math.exp(-logit));
    whatIfProbValue.textContent = `${(prob * 100).toFixed(1)}%`;

    // Determine badge text and color
    let category = 'High';
    let color = 'var(--accent-red)';
    if (prob < 0.3) { category = 'Low'; color = 'var(--accent-green)'; }
    else if (prob < 0.6) { category = 'Moderate'; color = '#fbbf24'; }

    // Color-blindness icon
    whatIfRiskBadge.innerHTML = category === 'High' ? `<span aria-hidden="true" style="margin-right: 4px;">⚠️</span>High Risk` : `${category} Risk`;
    whatIfRiskBadge.className = 'whatif-result__badge';
    whatIfRiskBadge.style.color = color;
    whatIfRiskBadge.style.backgroundColor = `color-mix(in srgb, ${color} 15%, transparent)`;
  };

  // Generate a slider/toggle for every feature we have a coefficient for
  for (const key of Object.keys(payload)) {
    if (_cachedCoefficients[key] === undefined) continue;

    const label = FEATURE_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const isNumericInput = ['age', 'bmi', 'sleepHours'].includes(key);
    const isBool = !isNumericInput && (payload[key] === 'true' || payload[key] === 'false' || typeof payload[key] === 'boolean' || payload[key] === 1 || payload[key] === 0);

    const groupDiv = document.createElement('div');
    groupDiv.className = 'whatif-group';

    if (isBool) {
      const currVal = (payload[key] === 'true' || payload[key] === true || payload[key] === 1) ? 1 : 0;
      groupDiv.innerHTML = `
        <div class="whatif-group__header" style="margin-bottom: 8px;">
          <span class="whatif-group__label">${label}</span>
        </div>
        <div class="toggle-group">
          <label class="toggle-option">
            <input type="radio" name="whatif-${key}" value="1" ${currVal ? 'checked' : ''} />
            <span class="toggle-option__label">Yes</span>
          </label>
          <label class="toggle-option">
            <input type="radio" name="whatif-${key}" value="0" ${!currVal ? 'checked' : ''} />
            <span class="toggle-option__label">No</span>
          </label>
        </div>
       `;
    } else {
      // Provide sensible min/max overrides based on feature
      let min = 0, max = 100, step = 1;
      if (key === 'age') { min = 18; max = 100; step = 1; }
      else if (key === 'bmi') { min = 15; max = 55; step = 0.5; }
      else if (key === 'sleepHours') { min = 2; max = 12; step = 0.5; }
      else { min = payload[key] * 0.5; max = payload[key] * 1.5; step = 0.1; }

      groupDiv.innerHTML = `
        <div class="whatif-group__header">
          <span class="whatif-group__label">${label}</span>
          <span class="whatif-group__value" id="whatif-val-${key}">${payload[key]}</span>
        </div>
        <input type="range" class="whatif-slider" id="whatif-in-${key}" min="${min}" max="${max}" step="${step}" value="${payload[key]}">
       `;
    }

    whatIfControls.appendChild(groupDiv);

    if (isBool) {
      const radios = groupDiv.querySelectorAll(`input[type="radio"]`);
      radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          currentSimState[key] = e.target.value === '1';
          updateSimResult();
        });
      });
    } else {
      const inputEl = groupDiv.querySelector(`#whatif-in-${key}`);
      const valEl = groupDiv.querySelector(`#whatif-val-${key}`);
      inputEl.addEventListener('input', (e) => {
        currentSimState[key] = parseFloat(e.target.value);
        valEl.textContent = currentSimState[key];
        updateSimResult();
      });
    }
  }

  updateSimResult(); // Initial UI hydration
}

/* ─── Explainability Bars ─── */


/**
 * Build factor contribution bars.
 * Fully dynamic: reads whatever keys exist in coefficients.json
 * (excluding "intercept") and computes value × coefficient for each.
 */
function buildExplainBars(payload) {
  const coefficients = _cachedCoefficients;
  if (!coefficients) {
    explainBars.innerHTML = '';
    return;
  }

  const parseBool = (v) => (v === true || v === 'true' || v === 1 ? 1 : 0);

  // Build a numeric feature map from whatever was sent in the payload
  const features = {};
  for (const [key, coeff] of Object.entries(coefficients)) {
    if (key === 'intercept') continue;

    if (payload[key] !== undefined) {
      const raw = payload[key];
      // Determine if boolean-like
      if (raw === 'true' || raw === 'false' || raw === true || raw === false) {
        features[key] = parseBool(raw);
      } else {
        features[key] = parseFloat(raw);
      }
    }
  }

  // Compute contributions
  const contributions = {};
  let maxAbs = 0;
  for (const [key, val] of Object.entries(features)) {
    if (coefficients[key] !== undefined) {
      const c = coefficients[key] * val;
      contributions[key] = c;
      if (Math.abs(c) > maxAbs) maxAbs = Math.abs(c);
    }
  }

  if (maxAbs === 0) maxAbs = 1;

  // Sort by absolute contribution and filter out zero-effect factors
  const sorted = Object.entries(contributions)
    .filter(([_, val]) => Math.abs(val) > 0.0001)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  explainBars.innerHTML = '';
  for (const [key, value] of sorted) {
    const isPositive = value >= 0;
    const pct = Math.min((Math.abs(value) / maxAbs) * 100, 100);

    const bar = document.createElement('div');
    bar.className = 'explain-bar';
    bar.innerHTML = `
      <span class="explain-bar__label">${autoLabel(key)}</span>
      <div class="explain-bar__track">
        <div class="explain-bar__fill explain-bar__fill--${isPositive ? 'positive' : 'negative'}" style="width: 0%"></div>
      </div>
      <span class="explain-bar__value explain-bar__value--${isPositive ? 'positive' : 'negative'}">
        ${isPositive ? '+' : ''}${value.toFixed(3)}
      </span>
    `;
    explainBars.appendChild(bar);

    // Animate bar width
    requestAnimationFrame(() => {
      const fill = bar.querySelector('.explain-bar__fill');
      fill.style.width = `${pct}%`;
    });
  }
}

/* ─── Error Display ─── */

function showError(message) {
  errorText.textContent = message;
  errorDiv.classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════════════════
   Health Insights Engine
   Generates personalized, evidence-based guidance.
   Content sourced from CDC, ADA, and NIH public guidelines.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Factor-specific insight content.
 * Each key corresponds to a coefficient key in the model.
 * `condition` receives the raw payload value and returns true
 * if this insight should be shown.
 */
const FACTOR_INSIGHTS = {
  bmi: {
    icon: '⚖️',
    getContent(bmiVal) {
      if (bmiVal >= 30) {
        return {
          title: 'Body Mass Index — Elevated',
          type: 'risk',
          body: `Your calculated BMI of <strong>${bmiVal.toFixed(1)}</strong> falls in the elevated range. `
            + 'Research from the CDC\'s Diabetes Prevention Program shows that <strong>modest, sustained changes</strong> — such as a 5–7% reduction in body weight through gradual dietary adjustments and increased movement — can reduce the risk of developing Type 2 diabetes by up to 58%. '
            + 'It\'s important to note that BMI is a population-level screening tool and does not capture the full picture of individual health. Factors like muscle mass, body composition, and genetics all play a role.',
          source: { text: 'CDC — Diabetes Prevention Program', url: 'https://www.cdc.gov/diabetes-prevention/' },
        };
      } else if (bmiVal >= 25) {
        return {
          title: 'Body Mass Index — Overweight Range',
          type: 'risk',
          body: `Your calculated BMI of <strong>${bmiVal.toFixed(1)}</strong> falls in the overweight range. `
            + 'While BMI alone is not a complete measure of health, population studies show a graded relationship between BMI and Type 2 diabetes risk. '
            + 'Small, sustainable lifestyle changes — like incorporating more whole grains, fruits, and vegetables — can meaningfully shift risk over time.',
          source: { text: 'NIH — Aim for a Healthy Weight', url: 'https://www.nhlbi.nih.gov/health/educational/lose_wt/' },
        };
      }
      return {
        title: 'Body Mass Index — Healthy Range',
        type: 'protective',
        body: `Your calculated BMI of <strong>${bmiVal.toFixed(1)}</strong> is within the range generally associated with lower metabolic risk. Continue maintaining balanced nutrition and regular movement.`,
        source: { text: 'CDC — Healthy Weight', url: 'https://www.cdc.gov/healthy-weight/' },
      };
    },
  },

  age: {
    icon: '📅',
    getContent(ageVal) {
      if (ageVal >= 45) {
        return {
          title: 'Age — Recommended Screening',
          type: 'risk',
          body: 'The American Diabetes Association recommends that <strong>all adults aged 45 and older</strong> be screened for prediabetes and Type 2 diabetes, even in the absence of other risk factors. '
            + 'Age is a non-modifiable risk factor, but early detection through routine screening (such as an A1C or fasting glucose test) enables timely intervention. '
            + 'Many community health centers offer low- or no-cost screenings regardless of insurance status.',
          source: { text: 'ADA — Standards of Care 2025', url: 'https://diabetesjournals.org/care/issue/48/Supplement_1' },
        };
      }
      return {
        title: 'Age — General Awareness',
        type: 'protective',
        body: 'While your age places you in a lower age-related risk bracket, the prevalence of Type 2 diabetes in younger adults has been increasing. Maintaining awareness of other risk factors — and having regular check-ups — remains important at every age.',
        source: { text: 'CDC — Diabetes Risk Factors', url: 'https://www.cdc.gov/diabetes/risk-factors/' },
      };
    },
  },

  HighBP: {
    icon: '❤️‍🩹',
    getContent(val) {
      const hasBP = val === 'true' || val === true || val === 1;
      if (hasBP) {
        return {
          title: 'Hypertension — A Shared Risk Factor',
          type: 'risk',
          body: 'High blood pressure and Type 2 diabetes frequently co-occur and share common underlying drivers, including insulin resistance and chronic inflammation. '
            + 'Managing blood pressure through regular monitoring, reduced sodium intake, stress management, and — when appropriate — medication can lower both cardiovascular and Type 2 diabetes risk. '
            + '<strong>Free blood pressure checks</strong> are available at many pharmacies, community health fairs, and federally qualified health centers (FQHCs).',
          source: { text: 'AHA — High Blood Pressure & Diabetes', url: 'https://www.heart.org/en/health-topics/high-blood-pressure' },
        };
      }
      return null; // No insight needed for "no hypertension"
    },
  },

  PhysActivity: {
    icon: '🏃',
    getContent(val) {
      const isActive = val === 'true' || val === true || val === 1;
      if (!isActive) {
        return {
          title: 'Physical Activity — Opportunity for Risk Reduction',
          type: 'risk',
          body: 'Regular physical activity is one of the most effective modifiable factors for reducing Type 2 diabetes risk. The CDC recommends <strong>150 minutes of moderate-intensity activity per week</strong> — this can include brisk walking, cycling, swimming, or even gardening. '
            + 'Activity does not need to happen in a gym; any consistent movement that raises your heart rate counts. Walking just 30 minutes a day, 5 days a week, meets this goal. '
            + 'Many communities offer free group walking programs, and local parks and recreation departments often have low-cost fitness resources.',
          source: { text: 'CDC — Physical Activity Guidelines', url: 'https://www.cdc.gov/physical-activity-basics/' },
        };
      }
      return {
        title: 'Physical Activity — Protective Factor',
        type: 'protective',
        body: 'Maintaining regular physical activity is one of the strongest protective behaviors against Type 2 diabetes. Evidence shows that consistent activity improves insulin sensitivity, reduces inflammation, and supports cardiovascular health. Keep it up!',
        source: { text: 'CDC — Benefits of Physical Activity', url: 'https://www.cdc.gov/physical-activity-basics/' },
      };
    },
  },

  sleepHours: {
    icon: '🌙',
    getContent(hours) {
      if (hours < 6) {
        return {
          title: 'Sleep — Below Recommended Duration',
          type: 'risk',
          body: `Averaging <strong>${hours} hours</strong> of sleep per night is below the recommended 7–9 hours for adults. `
            + 'Research shows that chronic short sleep is associated with impaired glucose metabolism, increased insulin resistance, and elevated appetite hormones — all of which contribute to Type 2 diabetes risk. '
            + 'Improving sleep hygiene — such as maintaining a consistent schedule, reducing screen time before bed, and creating a dark, cool sleep environment — can help.',
          source: { text: 'CDC — Sleep & Chronic Disease', url: 'https://www.cdc.gov/sleep/' },
        };
      } else if (hours > 9) {
        return {
          title: 'Sleep — Above Typical Range',
          type: 'risk',
          body: `Averaging <strong>${hours} hours</strong> of sleep per night is above the typical recommended range. `
            + 'While individual needs vary, consistently long sleep has been associated in some studies with metabolic changes. If you feel unrefreshed despite long sleep, consider discussing this with a healthcare provider to rule out underlying causes.',
          source: { text: 'NIH — Sleep Health', url: 'https://www.nhlbi.nih.gov/health/sleep' },
        };
      }
      return {
        title: 'Sleep — Within Recommended Range',
        type: 'protective',
        body: `Averaging <strong>${hours} hours</strong> of sleep is within the recommended range. Adequate sleep supports healthy glucose regulation and overall metabolic health.`,
        source: { text: 'CDC — Sleep Recommendations', url: 'https://www.cdc.gov/sleep/' },
      };
    },
  },

  // ─── Additional BRFSS variables (ready when the modeling team adds them) ───

  HighChol: {
    icon: '🩸',
    getContent(val) {
      const hasChol = val === 'true' || val === true || val === 1;
      if (hasChol) {
        return {
          title: 'High Cholesterol — Metabolic Risk Cluster',
          type: 'risk',
          body: 'High cholesterol often co-occurs with insulin resistance and is part of a cluster of metabolic risk factors. Regular lipid panel screenings and heart-healthy dietary patterns (such as the DASH or Mediterranean diets) can help manage both cholesterol and Type 2 diabetes risk.',
          source: { text: 'AHA — Cholesterol Management', url: 'https://www.heart.org/en/health-topics/cholesterol' },
        };
      }
      return null;
    },
  },

  Smoker: {
    icon: '🚭',
    getContent(val) {
      const smokes = val === 'true' || val === true || val === 1;
      if (smokes) {
        return {
          title: 'Tobacco Use — Modifiable Risk Factor',
          type: 'risk',
          body: 'Smokers are 30–40% more likely to develop Type 2 diabetes than non-smokers. Nicotine increases blood sugar levels and contributes to insulin resistance. Free cessation support is available through <strong>1-800-QUIT-NOW</strong> and smokefree.gov, which offer counseling, quit plans, and in some states, free nicotine replacement therapy.',
          source: { text: 'CDC — Smoking & Diabetes', url: 'https://www.cdc.gov/tobacco/' },
        };
      }
      return null;
    },
  },

  genHlth: {
    icon: '📋',
    getContent(val) {
      if (val >= 4) {
        return {
          title: 'Self-Reported Health — Fair/Poor',
          type: 'risk',
          body: 'Self-rated general health is a well-established predictor of chronic disease outcomes in public health research. If you feel your overall health could be better, consider connecting with a primary care provider or community health worker who can help identify actionable steps and connect you with local resources.',
          source: { text: 'CDC — BRFSS Health Status', url: 'https://www.cdc.gov/brfss/' },
        };
      }
      return null;
    },
  },

  diffWalk: {
    icon: '🦿',
    getContent(val) {
      const hasDiff = val === 'true' || val === true || val === 1;
      if (hasDiff) {
        return {
          title: 'Mobility — Adaptive Physical Activity',
          type: 'risk',
          body: 'Difficulty walking can limit access to traditional forms of exercise, but many effective alternatives exist. Chair exercises, water aerobics, resistance bands, and upper-body workouts can all improve insulin sensitivity. The National Center on Health, Physical Activity and Disability (NCHPAD) offers free adaptive fitness resources.',
          source: { text: 'NCHPAD — Adaptive Fitness', url: 'https://www.nchpad.org/' },
        };
      }
      return null;
    },
  },
};

/**
 * Risk-level summary messages.
 */
const RISK_SUMMARIES = {
  Low: {
    class: 'insights-summary--low',
    html: '<strong>Your estimated Type&nbsp;2 diabetes risk is in the lower range.</strong> '
      + 'While this is encouraging, risk can change over time with aging, weight changes, and other factors. '
      + 'Continuing healthy habits and staying up to date with routine screenings — including an <strong>A1C (hemoglobin A1C) test</strong> as recommended by your provider — is the best way to stay ahead. '
      + 'Below are some personalized observations based on your responses.',
  },
  Moderate: {
    class: 'insights-summary--moderate',
    html: '<strong>Your estimated Type&nbsp;2 diabetes risk falls in the moderate range.</strong> '
      + 'This does not mean you will develop Type&nbsp;2 diabetes — it means that based on the risk factors assessed, there are opportunities to take proactive steps. '
      + 'We recommend discussing these results with a healthcare provider, who can order an <strong>A1C test</strong> to assess your blood sugar levels over time. '
      + 'Many of the factors below are modifiable, and small, sustained changes can meaningfully reduce risk.',
  },
  High: {
    class: 'insights-summary--high',
    html: '<strong>Your estimated Type&nbsp;2 diabetes risk falls in the higher range.</strong> '
      + 'This result highlights the importance of scheduling a clinical screening with a healthcare provider. '
      + 'An <strong>A1C (hemoglobin A1C) test</strong>, fasting plasma glucose, or oral glucose tolerance test can determine whether you have prediabetes or Type&nbsp;2 diabetes — these lab tests are the only way to confirm a diagnosis. '
      + 'Early detection of prediabetes allows for early intervention; the CDC\'s Diabetes Prevention Program has shown that lifestyle changes can reduce progression to Type&nbsp;2 diabetes by up to 58%. '
      + 'The insights below identify which factors contributed most and what steps may help.',
  },
};

/**
 * Resources relevant to each risk level.
 */
const RESOURCES = {
  always: [
    { icon: '🏥', label: 'Find a Health Center (HRSA)', url: 'https://findahealthcenter.hrsa.gov/' },
    { icon: '🩸', label: 'What Is an A1C Test?', url: 'https://my.clevelandclinic.org/health/diagnostics/9731-a1c' },
    { icon: '📝', label: 'ADA Diabetes Risk Test', url: 'https://diabetes.org/diabetes-risk-test' },
  ],
  moderate: [
    { icon: '🎯', label: 'Find a CDC Diabetes Prevention Program Near You', url: 'https://www.cdc.gov/diabetes-prevention/lifestyle-change-program/find-a-program.html' },
    { icon: '🥗', label: 'MyPlate Nutrition Guide', url: 'https://www.myplate.gov/' },
  ],
  high: [
    { icon: '🎯', label: 'Find a CDC DPP Near You', url: 'https://www.cdc.gov/diabetes-prevention/lifestyle-change-program/find-a-program.html' },
    { icon: '📞', label: 'Free Nicotine Quit Line: 1-800-QUIT-NOW', url: 'https://www.smokefree.gov/' },
  ],
};

/**
 * Build the Health Insights panel based on the model results and SDoH context.
 */
function buildInsights(payload, result, sdohData) {
  const riskLevel = result.riskCategory; // "Low", "Moderate", "High"
  const parseBool = (v) => (v === true || v === 'true' || v === 1 ? 1 : 0);

  // ─── Summary ───
  let summary = RISK_SUMMARIES[riskLevel] || RISK_SUMMARIES.Moderate;

  // Conditionally augment the summary if SDoH indicates high vulnerability
  let summaryHtml = summary.html;
  if (sdohData && sdohData.isHighVulnerability) {
    summaryHtml += ' <br><br><strong>Neighborhood Context:</strong> We noticed your ZIP code indicates an area where social determinants of health (like food access or transportation) may impact wellness. Local community resources have been prioritized below to help support you.';
  }

  insightsSummary.className = `insights-summary ${summary.class}`;
  insightsSummary.innerHTML = summaryHtml;

  // ─── Factor insight cards ───
  // Determine which factors are in the model
  const coefficients = _cachedCoefficients || {};
  const featureKeys = Object.keys(coefficients).filter((k) => k !== 'intercept');

  // Get raw values from payload
  const rawValues = {};
  for (const key of featureKeys) {
    if (payload[key] !== undefined) {
      const raw = payload[key];
      if (raw === 'true' || raw === 'false' || raw === true || raw === false) {
        rawValues[key] = raw;
      } else {
        rawValues[key] = parseFloat(raw);
      }
    }
  }

  // Compute contributions and sort by impact
  const contributions = [];
  for (const key of featureKeys) {
    if (rawValues[key] !== undefined && coefficients[key] !== undefined) {
      const numVal = (typeof rawValues[key] === 'string')
        ? (rawValues[key] === 'true' ? 1 : 0)
        : rawValues[key];
      contributions.push({
        key,
        value: rawValues[key],
        contribution: coefficients[key] * numVal,
      });
    }
  }
  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Build cards for top factors (up to 3)
  insightsCards.innerHTML = '';
  let cardCount = 0;

  for (const { key, value } of contributions) {
    if (cardCount >= 3) break;

    const factorConfig = FACTOR_INSIGHTS[key];
    if (!factorConfig) continue;

    const content = factorConfig.getContent(value);
    if (!content) continue;

    const card = document.createElement('div');
    card.className = `insight-card insight-card--${content.type}`;
    card.innerHTML = `
      <div class="insight-card__header">
        <span class="insight-card__icon">${factorConfig.icon}</span>
        <span class="insight-card__title">${content.title}</span>
      </div>
      <div class="insight-card__body">${content.body}</div>
      ${content.source ? `<a class="insight-card__source" href="${content.source.url}" target="_blank" rel="noopener noreferrer">↗ ${content.source.text}</a>` : ''}
    `;
    insightsCards.appendChild(card);
    cardCount++;
  }

  // ─── Resources ───
  insightsResourcesList.innerHTML = '';
  const level = riskLevel.toLowerCase();
  const resources = [
    ...RESOURCES.always,
    ...(RESOURCES[level] || []),
  ];

  if (sdohData && sdohData.isHighVulnerability) {
    // Inject SDoH specific supportive resources
    resources.push({ icon: '🛒', label: 'Local Food Banks (Feeding America)', url: 'https://www.feedingamerica.org/find-your-local-foodbank' });
    resources.push({ icon: '🤝', label: '211 Essential Services (Housing, Food, Care)', url: 'https://www.211.org/' });
  }

  // Deduplicate by URL
  const seen = new Set();
  for (const r of resources) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    const pill = document.createElement('a');
    pill.className = 'resource-pill';
    pill.href = r.url;
    pill.target = '_blank';
    pill.rel = 'noopener noreferrer';
    pill.innerHTML = `<span class="resource-pill__icon">${r.icon}</span> ${r.label}`;
    insightsResourcesList.appendChild(pill);
  }

  // ─── Doctor Questions: only show for Moderate / High ───
  const doctorQuestionsEl = document.getElementById('doctorQuestions');
  if (doctorQuestionsEl) {
    if (riskLevel === 'Moderate' || riskLevel === 'High') {
      doctorQuestionsEl.style.display = '';
    } else {
      doctorQuestionsEl.style.display = 'none';
    }
  }
}

/* ─── Nearby Health Center Finder ─── */

const clinicZipInput = document.getElementById('clinicZip');
const clinicSearchBtn = document.getElementById('clinicSearchBtn');
const clinicResults = document.getElementById('clinicResults');

if (clinicSearchBtn) {
  clinicSearchBtn.addEventListener('click', searchClinics);
  clinicZipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchClinics();
  });
}

async function searchClinics() {
  const zip = (clinicZipInput.value || '').trim();
  if (!/^\d{5}$/.test(zip)) {
    clinicResults.innerHTML = '<div class="clinic-results--error">Please enter a valid 5-digit ZIP code.</div>';
    return;
  }

  clinicSearchBtn.disabled = true;
  clinicSearchBtn.textContent = 'Searching…';
  clinicResults.innerHTML = '<div class="clinic-results--loading">🔍 Searching for health centers near you…</div>';

  try {
    const res = await fetch(`/nearby-clinics?zip=${zip}&radius=20`);
    const data = await res.json();

    if (!res.ok) {
      clinicResults.innerHTML = `<div class="clinic-results--error">${data.error || 'Something went wrong.'}</div>`;
      return;
    }

    if (data.centers.length === 0) {
      clinicResults.innerHTML = '<div class="clinic-results--empty">No health centers found within 20 miles. Try a different ZIP code or expand your search at <a href="https://findahealthcenter.hrsa.gov/" target="_blank" rel="noopener">findahealthcenter.hrsa.gov</a>.</div>';
      return;
    }

    clinicResults.innerHTML = data.centers.map((c) => {
      const phonePart = c.phone
        ? `<a href="tel:${c.phone.replace(/\D/g, '')}">${c.phone}</a>`
        : '';
      const webPart = c.website
        ? `<a href="${c.website.startsWith('http') ? c.website : 'https://' + c.website}" target="_blank" rel="noopener">Website ↗</a>`
        : '';
      const metaParts = [phonePart, webPart].filter(Boolean).join('');
      return `
        <div class="clinic-card">
          <div class="clinic-card__header">
            <span class="clinic-card__name">${c.name}</span>
            <span class="clinic-card__distance">${c.distance} mi</span>
          </div>
          <div class="clinic-card__address">${c.address}</div>
          ${metaParts ? `<div class="clinic-card__meta">${metaParts}</div>` : ''}
        </div>`;
    }).join('');
  } catch (err) {
    clinicResults.innerHTML = '<div class="clinic-results--error">Unable to reach the health center directory. Please check your connection and try again.</div>';
  } finally {
    clinicSearchBtn.disabled = false;
    clinicSearchBtn.textContent = 'Search';
  }
}

/* ─── Form Progress Bar ─── */

(function initFormProgress() {
  const progressFill = document.getElementById('formProgressFill');
  const progressLabel = document.getElementById('formProgressLabel');
  if (!progressFill || !progressLabel) return;

  // Define all required fields to track
  const numberFields = ['age', 'weightLbs', 'heightFt', 'heightIn', 'sleepHours'];
  const radioGroups = [
    'HighBP', 'HighChol', 'CholCheck', 'Smoker',
    'Stroke', 'HeartDiseaseorAttack', 'PhysActivity',
    'Fruits', 'Veggies', 'HvyAlcoholConsump', 'AnyHealthcare'
  ];
  const checkboxId = 'dataConsent';
  const totalFields = numberFields.length + radioGroups.length + 1; // +1 for consent

  function countCompleted() {
    let count = 0;

    // Number/text inputs — completed if they have a non-empty value
    for (const id of numberFields) {
      const el = document.getElementById(id);
      if (el && el.value.trim() !== '') count++;
    }

    // Radio groups — completed if any option is selected
    for (const name of radioGroups) {
      if (document.querySelector(`input[name="${name}"]:checked`)) count++;
    }

    // Consent checkbox
    const consent = document.getElementById(checkboxId);
    if (consent && consent.checked) count++;

    return count;
  }

  function updateProgress() {
    const completed = countCompleted();
    const pct = Math.round((completed / totalFields) * 100);

    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `${completed} of ${totalFields} fields`;

    if (completed === totalFields) {
      progressFill.setAttribute('data-complete', 'true');
    } else {
      progressFill.removeAttribute('data-complete');
    }
  }

  // Attach listeners to all form elements
  const formEl = document.getElementById('riskForm');
  if (formEl) {
    formEl.addEventListener('input', updateProgress);
    formEl.addEventListener('change', updateProgress);
  }

  // Initial state
  updateProgress();
})();

/* --- Voice Guided Assistant --- */
(function initVoiceAssistant() {
  const voiceBtn = document.getElementById('voiceBtn');
  const voiceBtnText = document.getElementById('voiceBtnText');
  if (!voiceBtn) return;

  // Check support
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    voiceBtn.style.display = 'none';
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let voiceActive = false;
  let currentQuestionIndex = 0;

  const questionsList = [
    { id: 'age', text: "What is your age in years?", type: 'number' },
    { id: 'weightLbs', text: "What is your weight in pounds?", type: 'number' },
    { id: 'heightFt', text: "How tall are you in feet?", type: 'number' },
    { id: 'heightIn', text: "And inches?", type: 'number' },
    { id: 'zipCode', text: "What is your ZIP code? You can say skip if you want.", type: 'number', optional: true },
    { name: 'HighBP', text: "Have you ever been told by a doctor that you have high blood pressure?", type: 'radio' },
    { name: 'HighChol', text: "Have you ever been told that you have high cholesterol?", type: 'radio' },
    { name: 'CholCheck', text: "Have you had your cholesterol checked within the past 5 years?", type: 'radio' },
    { name: 'Smoker', text: "Have you ever smoked at least 100 cigarettes in your lifetime?", type: 'radio' },
    { name: 'Stroke', text: "Have you ever been told you had a stroke?", type: 'radio' },
    { name: 'HeartDiseaseorAttack', text: "Have you ever been told you had a heart attack or coronary heart disease?", type: 'radio' },
    { id: 'sleepHours', text: "On average, how many hours of sleep do you get in a 24-hour period?", type: 'number' },
    { name: 'PhysActivity', text: "During the past 30 days, did you participate in any physical activity or exercise?", type: 'radio' },
    { name: 'Fruits', text: "Do you usually eat fruit at least once per day?", type: 'radio' },
    { name: 'Veggies', text: "Do you usually eat vegetables at least once per day?", type: 'radio' },
    { name: 'HvyAlcoholConsump', text: "Do you participate in heavy drinking based on CDC guidelines?", type: 'radio' },
    { name: 'AnyHealthcare', text: "Do you currently have any kind of healthcare coverage?", type: 'radio' }
  ];

  function speak(text, callback) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      if (callback && voiceActive) callback();
    };
    window.speechSynthesis.speak(utterance);
  }

  function askCurrentQuestion() {
    if (!voiceActive) return;
    const q = questionsList[currentQuestionIndex];

    // Highlight UI
    document.querySelectorAll('.form-group').forEach(el => el.classList.remove('highlight-voice'));
    let targetEl = null;

    if (q.id) {
      targetEl = document.getElementById(q.id);
    } else if (q.name) {
      targetEl = document.querySelector(`input[name="${q.name}"]`);
    }

    if (targetEl) {
      const parent = targetEl.closest('.form-group');
      if (parent) {
        parent.classList.add('highlight-voice');
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    speak(q.text, () => {
      if (voiceActive) {
        try { recognition.start(); } catch (e) { }
      }
    });
  }

  recognition.onresult = (event) => {
    if (!voiceActive) return;
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    const currentQ = questionsList[currentQuestionIndex];

    let understood = false;

    if (currentQ.type === 'number') {
      if (transcript.includes('skip') && currentQ.optional) {
        understood = true;
      } else {
        const match = transcript.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          const input = document.getElementById(currentQ.id);
          input.value = num;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          understood = true;
        }
      }
    } else if (currentQ.type === 'radio') {
      if (transcript.includes('yes') || transcript.includes('yeah') || transcript.includes('yep')) {
        const rad = document.querySelector(`input[name="${currentQ.name}"][value="true"]`);
        if (rad) {
          rad.checked = true;
          rad.dispatchEvent(new Event('change', { bubbles: true }));
          understood = true;
        }
      } else if (transcript.includes('no') || transcript.includes('nope') || transcript.includes('nah') || transcript.includes('not')) {
        const rad = document.querySelector(`input[name="${currentQ.name}"][value="false"]`);
        if (rad) {
          rad.checked = true;
          rad.dispatchEvent(new Event('change', { bubbles: true }));
          understood = true;
        }
      }
    }

    if (understood) {
      currentQuestionIndex++;
      if (currentQuestionIndex < questionsList.length) {
        setTimeout(askCurrentQuestion, 600);
      } else {
        document.querySelectorAll('.form-group').forEach(el => el.classList.remove('highlight-voice'));

        // Ensure consent is checked if they made it this far
        const consentCheckbox = document.getElementById('dataConsent');
        if (consentCheckbox && !consentCheckbox.checked) {
          consentCheckbox.checked = true;
          consentCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const submitLabel = submitBtnSpan ? submitBtnSpan.textContent : 'Submit';
        speak(`Thank you. Please review your answers and click ${submitLabel} to continue.`);
        stopVoiceGuided();
      }
    } else {
      speak("I didn't quite catch that. " + currentQ.text, () => {
        if (voiceActive) try { recognition.start(); } catch (e) { }
      });
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech' && voiceActive) {
      // Ask again if no speech detected
      askCurrentQuestion();
    } else {
      console.error('Speech recognition error', event.error);
      stopVoiceGuided();
    }
  };

  recognition.onend = () => {
    // Some browsers stop recognition constantly. Re-trigger if still active and not waiting for speech logic.
    // The recognition is normally restarted by the speak() callback.
  };

  function startVoiceGuided() {
    window.speechSynthesis.cancel();
    voiceActive = true;
    voiceBtn.classList.add('is-listening');
    voiceBtnText.textContent = 'Voice Active';
    currentQuestionIndex = 0;

    // Auto-scroll to top
    document.getElementById('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });

    speak("I am your automated health assistant. I will read you the questions now.", askCurrentQuestion);
  }

  function stopVoiceGuided() {
    voiceActive = false;
    try { recognition.stop(); } catch (e) { }
    window.speechSynthesis.cancel();
    voiceBtn.classList.remove('is-listening');
    voiceBtnText.textContent = 'Voice Mode';
    document.querySelectorAll('.form-group').forEach(el => el.classList.remove('highlight-voice'));
  }

  voiceBtn.addEventListener('click', () => {
    if (voiceActive) {
      stopVoiceGuided();
    } else {
      startVoiceGuided();
    }
  });

})();
