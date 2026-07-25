import { ReviewComposer } from "@/components/review-composer";

export default function Dashboard() {
  return (
    <section className="audit-home">
      <div className="audit-intro">
        <span className="eyebrow">Enter the circle</span>
        <h1>Bring your code before the ritual.</h1>
        <p>Paste or upload a source file. The LLM will return its findings.</p>
      </div>
      <ReviewComposer />
    </section>
  );
}
