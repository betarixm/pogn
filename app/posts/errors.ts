export class PostSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostSubmissionError";
  }
}

export class ReplySubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplySubmissionError";
  }
}

export class HeartSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HeartSubmissionError";
  }
}
