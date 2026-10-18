import { ExternalLink, FileText } from "lucide-react";
import {
  MATCH_DAY_RULES,
  OFFICIAL_DOCUMENTS,
  WORK_DUTY,
  type EventKind,
  type OvaSource,
} from "@/lib/ova-rules";
import { Card, SectionTitle } from "./ui";

function SourceLink({ source }: { source: OvaSource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-brand underline"
    >
      {source.label}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function MatchDayRules({ kind }: { kind: EventKind }) {
  return (
    <section aria-labelledby="match-day-rules">
      <SectionTitle>
        <span id="match-day-rules">Match-day rules</span>
      </SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MATCH_DAY_RULES[kind].map((rule) => (
          <Card key={rule.title}>
            <h3 className="font-semibold">{rule.title}</h3>
            <p className="mt-1 text-sm">{rule.body}</p>
            <SourceLink source={rule.source} />
          </Card>
        ))}
      </div>
    </section>
  );
}

export function OfficialDocuments({ kind }: { kind: EventKind }) {
  return (
    <section aria-labelledby="official-documents">
      <SectionTitle>
        <span id="official-documents">Official OVA documents</span>
      </SectionTitle>
      <Card>
        <ul className="grid gap-1">
          {[...OFFICIAL_DOCUMENTS[kind], ...OFFICIAL_DOCUMENTS.all].map((doc) => (
            <li key={doc.url}>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand underline"
              >
                <FileText aria-hidden className="h-4 w-4 shrink-0" />
                {doc.label}
                <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <span className="sr-only">(PDF, opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

export function WorkDutyChecklist({ kind }: { kind: EventKind }) {
  const duty = WORK_DUTY[kind];
  return (
    <Card className="mb-3">
      <h3 className="font-semibold">What your team must do</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {duty.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <SourceLink source={duty.source} />
    </Card>
  );
}
