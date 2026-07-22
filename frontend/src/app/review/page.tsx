import { ReviewComposer } from "@/components/review-composer";

export default function ReviewPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Create review</span>
          <h1>Paste code for an AI security audit</h1>
          <p>
            Choose a programming language or let CodeProof detect it. Ritual
            LLM audits the code, while source and report hashes remain
            authoritative on Ritual Chain.
          </p>
        </div>
      </div>
      <ReviewComposer />
    </>
  );
}
