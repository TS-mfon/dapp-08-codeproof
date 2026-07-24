import { ReviewComposer } from "@/components/review-composer";

export default function Dashboard() {
  return (
    <section className="audit-home">
      <div className="audit-intro">
        <span className="eyebrow">Ritual LLM</span>
        <h1>Find what your code missed.</h1>
        <p>Paste code. Get a focused security audit in seconds.</p>
      </div>
      <ReviewComposer />
    </section>
  );
}
