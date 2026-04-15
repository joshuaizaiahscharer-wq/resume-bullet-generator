const examples = [
  {
    before: "Worked at a restaurant and took orders",
    after:
      "Managed high-volume order flow in a fast-paced restaurant environment, serving 100+ customers per shift while maintaining accuracy and efficiency",
  },
  {
    before: "Helped with social media posts",
    after:
      "Planned and published weekly social content calendar across Instagram and LinkedIn, improving average engagement by 34% over 90 days",
  },
  {
    before: "Answered customer emails",
    after:
      "Resolved 40+ customer inquiries per day via email and chat, maintaining a 96% satisfaction rating while reducing response time by 22%",
  },
];

export function BeforeAfterSection() {
  return (
    <section id="examples">
      <div className="flex flex-col items-center text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Real Examples</span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          See the Transformation
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Watch how generic job descriptions become powerful, metric-driven achievements.
        </p>
      </div>

      <div className="mt-10 space-y-4 md:mt-12">
        {examples.map((example, index) => (
          <article
            key={index}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="grid md:grid-cols-2">
              <div className="border-b border-border bg-card p-5 md:border-b-0 md:border-r">
                <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Before
                </span>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{example.before}</p>
              </div>
              <div className="bg-primary/5 p-5">
                <span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  After
                </span>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{example.after}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
