/**
 * ============================================================
 * AI SERVICE - Advanced Worker Finder v3.0.0
 * Intelligent matching, fraud detection, pricing prediction
 * ============================================================
 */

const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.modelVersion = '3.0.0';
  }

  // ─── Smart Worker Matching ────────────────────────────────
  /**
   * Score and rank workers based on job requirements + ML factors
   * @param {Object} jobRequirements - Job details
   * @param {Array} workers - List of workers from DB
   * @returns {Array} Ranked workers with match scores
   */
  rankWorkersForJob(jobRequirements, workers) {
    if (!workers || workers.length === 0) return [];

    const scored = workers.map(worker => {
      let score = 0;
      const reasons = [];

      // 1. Rating Score (0-30 points)
      const rating = parseFloat(worker.average_rating) || 0;
      const ratingScore = (rating / 5) * 30;
      score += ratingScore;
      if (rating >= 4.5) reasons.push('Highly rated');

      // 2. Experience Score (0-25 points)
      const exp = parseInt(worker.experience_years) || 0;
      const expScore = Math.min(exp / 10, 1) * 25;
      score += expScore;
      if (exp >= 5) reasons.push('Experienced professional');

      // 3. Job Completion Rate (0-20 points)
      const total = parseInt(worker.total_jobs) || 0;
      const completed = parseInt(worker.completed_jobs) || 0;
      if (total > 0) {
        const completionRate = completed / total;
        score += completionRate * 20;
        if (completionRate >= 0.9) reasons.push('High completion rate');
      }

      // 4. Proximity Score (0-15 points)
      if (worker.distance !== undefined && worker.distance !== null) {
        const dist = parseFloat(worker.distance);
        if (dist <= 2) { score += 15; reasons.push('Very nearby'); }
        else if (dist <= 5) { score += 12; }
        else if (dist <= 10) { score += 8; }
        else if (dist <= 20) { score += 4; }
      }

      // 5. Availability Bonus (0-5 points)
      if (worker.is_available === 1 || worker.is_available === true) {
        score += 5;
        reasons.push('Available now');
      }

      // 6. Review Count Confidence Boost (0-5 points)
      const reviewCount = parseInt(worker.review_count) || 0;
      if (reviewCount >= 20) { score += 5; reasons.push('Many reviews'); }
      else if (reviewCount >= 10) { score += 3; }
      else if (reviewCount >= 5) { score += 1; }

      // 7. Profile Completeness (0-5 points)
      let completeness = 0;
      if (worker.bio) completeness += 1;
      if (worker.profile_photo_url) completeness += 1;
      if (worker.skills) completeness += 1;
      if (worker.certifications) completeness += 1;
      if (worker.city) completeness += 1;
      score += completeness;

      // 8. Category Penalty - reduce score if budget mismatch
      if (jobRequirements.budget && worker.hourly_rate) {
        const budget = parseFloat(jobRequirements.budget);
        const rate = parseFloat(worker.hourly_rate);
        if (rate > budget * 1.5) score -= 10; // too expensive
      }

      return {
        ...worker,
        ai_match_score: Math.round(Math.min(score, 100) * 10) / 10,
        ai_match_reasons: reasons,
        ai_recommended: score >= 70
      };
    });

    return scored.sort((a, b) => b.ai_match_score - a.ai_match_score);
  }

  // ─── Fraud Detection ──────────────────────────────────────
  /**
   * Analyze user behavior for fraud signals
   * @param {Object} data - { ipAddress, userId, action, metadata }
   * @returns {Object} { riskScore, riskLevel, flags }
   */
  detectFraud(data) {
    const { action, metadata = {} } = data;
    let riskScore = 0;
    const flags = [];

    // Rapid registration pattern
    if (action === 'register') {
      if (metadata.registrationsFromIp > 3) {
        riskScore += 40;
        flags.push('Multiple registrations from same IP');
      }
      if (metadata.disposableEmail) {
        riskScore += 20;
        flags.push('Disposable email detected');
      }
    }

    // Login anomalies
    if (action === 'login') {
      if (metadata.failedAttempts >= 3) {
        riskScore += 30;
        flags.push('Multiple failed login attempts');
      }
      if (metadata.newDevice && metadata.newLocation) {
        riskScore += 15;
        flags.push('New device + new location');
      }
    }

    // Payment fraud signals
    if (action === 'payment') {
      if (metadata.amount > 50000) {
        riskScore += 10;
        flags.push('High value transaction');
      }
      if (metadata.rapidPayments > 2) {
        riskScore += 25;
        flags.push('Rapid successive payments');
      }
    }

    // Review manipulation
    if (action === 'review') {
      if (metadata.reviewsInLastHour > 3) {
        riskScore += 35;
        flags.push('Suspicious review activity');
      }
    }

    let riskLevel = 'low';
    if (riskScore >= 70) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    return {
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      flags,
      shouldBlock: riskScore >= 70,
      requiresVerification: riskScore >= 40,
      timestamp: new Date().toISOString()
    };
  }

  // ─── Smart Pricing Engine ─────────────────────────────────
  /**
   * Suggest optimal price range for a job
   * @param {Object} params - { category, location, experience, urgency }
   * @returns {Object} Pricing recommendation
   */
  suggestJobPricing(params) {
    const { category = '', location = '', experience = 0, urgency = 'normal' } = params;

    // Base rates by category (INR)
    const categoryRates = {
      plumber: { min: 300, max: 800, hourly: 250 },
      electrician: { min: 400, max: 1000, hourly: 300 },
      carpenter: { min: 350, max: 900, hourly: 280 },
      painter: { min: 250, max: 700, hourly: 200 },
      cleaner: { min: 200, max: 500, hourly: 150 },
      driver: { min: 500, max: 1500, hourly: 300 },
      cook: { min: 300, max: 800, hourly: 200 },
      tutor: { min: 400, max: 1200, hourly: 400 },
      mechanic: { min: 400, max: 1000, hourly: 350 },
      security: { min: 600, max: 1500, hourly: 400 },
      default: { min: 300, max: 800, hourly: 250 }
    };

    const catKey = Object.keys(categoryRates).find(k =>
      category.toLowerCase().includes(k)
    ) || 'default';
    const base = categoryRates[catKey];

    // Location multiplier
    const tier1Cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune'];
    const tier2Cities = ['jaipur', 'lucknow', 'nagpur', 'ahmedabad', 'surat', 'kochi'];
    let locationMultiplier = 1.0;
    const loc = location.toLowerCase();
    if (tier1Cities.some(c => loc.includes(c))) locationMultiplier = 1.4;
    else if (tier2Cities.some(c => loc.includes(c))) locationMultiplier = 1.2;

    // Experience multiplier
    const expMultiplier = 1 + Math.min(experience * 0.05, 0.5);

    // Urgency multiplier
    const urgencyMultipliers = { low: 0.9, normal: 1.0, high: 1.2, urgent: 1.5 };
    const urgencyMult = urgencyMultipliers[urgency] || 1.0;

    const finalMultiplier = locationMultiplier * expMultiplier * urgencyMult;

    return {
      suggested_min: Math.round(base.min * finalMultiplier),
      suggested_max: Math.round(base.max * finalMultiplier),
      hourly_rate: Math.round(base.hourly * finalMultiplier),
      market_rate: Math.round(((base.min + base.max) / 2) * finalMultiplier),
      factors: {
        category: catKey,
        location_tier: tier1Cities.some(c => loc.includes(c)) ? 'tier1' :
                       tier2Cities.some(c => loc.includes(c)) ? 'tier2' : 'tier3',
        experience_years: experience,
        urgency,
        final_multiplier: Math.round(finalMultiplier * 100) / 100
      },
      confidence: 'high',
      currency: 'INR'
    };
  }

  // ─── Job Description Enhancer ────────────────────────────
  /**
   * Improve job title/description clarity
   * @param {string} description - Original description
   * @returns {Object} Enhanced description + keywords
   */
  enhanceJobDescription(description) {
    if (!description) return { enhanced: '', keywords: [], quality_score: 0 };

    const words = description.trim().split(/\s+/);
    const quality_score = Math.min(100, words.length * 5 + (description.includes('?') ? 0 : 10));

    const professionKeywords = [
      'plumber', 'electrician', 'carpenter', 'painter', 'cleaner', 'driver',
      'cook', 'tutor', 'mechanic', 'security', 'gardener', 'nurse', 'ac repair',
      'pest control', 'water purifier', 'movers', 'packers'
    ];

    const keywords = professionKeywords.filter(k =>
      description.toLowerCase().includes(k)
    );

    const suggestions = [];
    if (words.length < 10) suggestions.push('Add more details about the task');
    if (!description.match(/\d+/)) suggestions.push('Include budget or quantity if applicable');
    if (!description.match(/\b(urgent|today|asap|tomorrow|weekend)\b/i))
      suggestions.push('Mention timeline or urgency');

    return {
      original: description,
      keywords,
      quality_score,
      improvement_suggestions: suggestions,
      word_count: words.length,
      is_detailed: words.length >= 15
    };
  }

  // ─── Smart Notifications ──────────────────────────────────
  /**
   * Generate personalized notification message
   * @param {string} type - Notification type
   * @param {Object} data - Context data
   * @returns {Object} { title, body, priority }
   */
  generateNotification(type, data = {}) {
    const templates = {
      job_assigned: {
        title: '🎉 New Job Assigned!',
        body: `You have been assigned the job: "${data.jobTitle || 'New Job'}". Check details and confirm.`,
        priority: 'high'
      },
      job_completed: {
        title: '✅ Job Completed',
        body: `Job "${data.jobTitle || 'Your job'}" has been marked as completed. Please leave a review!`,
        priority: 'medium'
      },
      payment_received: {
        title: '💰 Payment Received!',
        body: `₹${data.amount || 0} has been credited to your account for job "${data.jobTitle || 'completed work'}".`,
        priority: 'high'
      },
      payment_failed: {
        title: '⚠️ Payment Failed',
        body: `Payment of ₹${data.amount || 0} failed. Please try again or use another payment method.`,
        priority: 'critical'
      },
      new_review: {
        title: '⭐ New Review Received',
        body: `${data.reviewerName || 'A user'} gave you ${data.rating || 5} stars! Check your profile.`,
        priority: 'medium'
      },
      new_message: {
        title: '💬 New Message',
        body: `${data.senderName || 'Someone'} sent you a message: "${data.preview || '...'}".`,
        priority: 'medium'
      },
      dispute_opened: {
        title: '⚠️ Dispute Opened',
        body: `A dispute has been opened for job "${data.jobTitle || 'your job'}". Please respond within 24 hours.`,
        priority: 'critical'
      },
      otp_verify: {
        title: '🔐 Verify Your Account',
        body: `Your OTP is ${data.otp || '000000'}. Valid for ${data.expiry || 10} minutes. Do not share.`,
        priority: 'critical'
      },
      referral_bonus: {
        title: '🎁 Referral Bonus!',
        body: `₹${data.bonus || 100} referral bonus added! Keep referring to earn more.`,
        priority: 'medium'
      },
      subscription_expiring: {
        title: '⏰ Subscription Expiring',
        body: `Your subscription expires in ${data.daysLeft || 3} days. Renew now to keep premium features.`,
        priority: 'high'
      }
    };

    return templates[type] || {
      title: '🔔 Notification',
      body: data.message || 'You have a new notification.',
      priority: 'low'
    };
  }

  // ─── Worker Performance Analytics ────────────────────────
  /**
   * Analyze worker performance and provide insights
   * @param {Object} stats - Worker statistics from DB
   * @returns {Object} Performance analysis
   */
  analyzeWorkerPerformance(stats) {
    const {
      total_jobs = 0,
      completed_jobs = 0,
      average_rating = 0,
      response_time_avg = null
    } = stats;

    const completionRate = total_jobs > 0 ? (completed_jobs / total_jobs) * 100 : 0;
    const rating = parseFloat(average_rating) || 0;

    let tier = 'Bronze';
    let tierScore = 0;
    if (rating >= 4.8 && completionRate >= 95) { tier = 'Diamond'; tierScore = 100; }
    else if (rating >= 4.5 && completionRate >= 90) { tier = 'Platinum'; tierScore = 85; }
    else if (rating >= 4.0 && completionRate >= 80) { tier = 'Gold'; tierScore = 70; }
    else if (rating >= 3.5 && completionRate >= 70) { tier = 'Silver'; tierScore = 55; }
    else { tierScore = Math.max(completionRate / 2 + rating * 5, 10); }

    const insights = [];
    if (completionRate < 80) insights.push('Improve job completion rate to boost ranking');
    if (rating < 4.0) insights.push('Focus on quality to improve ratings');
    if (total_jobs < 10) insights.push('Complete more jobs to build credibility');
    if (rating >= 4.5 && total_jobs >= 20) insights.push('Eligible for Featured Worker badge');

    return {
      tier,
      tier_score: Math.round(tierScore),
      completion_rate: Math.round(completionRate * 10) / 10,
      performance_grade: rating >= 4.5 ? 'A+' : rating >= 4.0 ? 'A' : rating >= 3.5 ? 'B' : rating >= 3.0 ? 'C' : 'D',
      insights,
      badges: [
        ...(completionRate >= 95 ? ['🏆 Top Performer'] : []),
        ...(rating >= 4.8 ? ['⭐ 5-Star Worker'] : []),
        ...(total_jobs >= 50 ? ['💼 Expert Worker'] : total_jobs >= 20 ? ['👷 Experienced'] : []),
        ...(stats.is_verified ? ['✅ Verified Professional'] : [])
      ]
    };
  }

  // ─── Search Intent Classification ────────────────────────
  /**
   * Understand what a seeker is searching for
   * @param {string} searchQuery - Raw search text
   * @returns {Object} Classified intent
   */
  classifySearchIntent(searchQuery) {
    if (!searchQuery) return { category: null, intent: 'browse', keywords: [] };

    const query = searchQuery.toLowerCase();

    const intentMap = {
      urgent: ['urgent', 'emergency', 'asap', 'immediately', 'right now', 'today'],
      budget: ['cheap', 'affordable', 'low cost', 'budget', 'reasonable'],
      quality: ['best', 'top rated', 'experienced', 'professional', 'expert'],
      nearby: ['near me', 'nearby', 'close', 'local']
    };

    const detectedIntents = [];
    for (const [intent, keywords] of Object.entries(intentMap)) {
      if (keywords.some(k => query.includes(k))) {
        detectedIntents.push(intent);
      }
    }

    const categoryMap = {
      plumbing: ['plumber', 'pipe', 'leak', 'drain', 'tap', 'water'],
      electrical: ['electrician', 'wiring', 'socket', 'short circuit', 'power'],
      carpentry: ['carpenter', 'furniture', 'wood', 'cabinet', 'door'],
      painting: ['painter', 'paint', 'whitewash', 'colour', 'wall'],
      cleaning: ['cleaner', 'clean', 'sweep', 'mop', 'sanitize', 'housekeeping'],
      driving: ['driver', 'drive', 'cab', 'transport', 'pickup'],
      cooking: ['cook', 'chef', 'food', 'meal', 'kitchen'],
      tutoring: ['tutor', 'teacher', 'coaching', 'teach', 'study'],
      mechanical: ['mechanic', 'car repair', 'vehicle', 'bike', 'engine'],
      security: ['security', 'guard', 'watchman', 'cctv']
    };

    let detectedCategory = null;
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(k => query.includes(k))) {
        detectedCategory = cat;
        break;
      }
    }

    return {
      category: detectedCategory,
      intents: detectedIntents,
      primary_intent: detectedIntents[0] || 'browse',
      is_urgent: detectedIntents.includes('urgent'),
      prefers_budget: detectedIntents.includes('budget'),
      prefers_quality: detectedIntents.includes('quality'),
      wants_nearby: detectedIntents.includes('nearby'),
      original_query: searchQuery
    };
  }
}

module.exports = new AIService();
