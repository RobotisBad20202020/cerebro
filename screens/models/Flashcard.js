class Flashcard {
    constructor(question, answer) {
      this.question = question;
      this.answer = answer;
      this.easeFactor = 2.5; // Starting ease factor
      this.interval = 1; // Initial interval in days (after first review)
      this.repetitions = 0; // Number of repetitions (successful reviews)
      this.lastReviewed = new Date(); // When the card was last reviewed
      this.reviewCount = 0; // Track how many times the card has been reviewed
    }
  
    review(quality) {
      let intervalChange;
  
      // Handle the first review (learning phase)
      if (this.reviewCount === 0) {
        if (quality === 0) {
          intervalChange = 0.03; // 30 seconds
        } else if (quality === 1) {
          intervalChange = 1; // 1 day
        } else {
          intervalChange = 1; // 1 day for "Good" or "Easy"
        }
        this.repetitions = 1;
        this.reviewCount++;
      } else {
        if (quality === 0) {
          intervalChange = 0.03; // Retry in 30 seconds
          this.repetitions = 0;
          this.reviewCount = 0; // Reset to first review
        } else if (quality === 1) {
          intervalChange = this.interval * 1.2; // Hard: slight increase
          this.repetitions++;
        } else if (quality === 2) {
          intervalChange = this.interval * this.easeFactor; // Good: normal increase
          this.repetitions++;
        } else if (quality === 3) {
          intervalChange = this.interval * this.easeFactor * 1.3; // Easy: large increase
          this.repetitions++;
        }
      }
  
      this.interval = Math.round(intervalChange);
      this.easeFactor = this.updateEaseFactor(quality);
      this.lastReviewed = new Date();
    }
  
    updateEaseFactor(quality) {
      if (quality >= 2) {
        this.easeFactor = this.easeFactor - 0.8 + 0.28 * quality - 0.02 * quality * quality;
        if (this.easeFactor < 1.3) {
          this.easeFactor = 1.3; // Minimum ease factor
        }
      }
      return this.easeFactor;
    }
  
    getNextReviewDate() {
      const nextReview = new Date(this.lastReviewed);
      nextReview.setDate(nextReview.getDate() + this.interval);
      return nextReview;
    }
  }
  