import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Globe, Users, Search, Wrench } from "lucide-react";
import SEO from "@/components/SEO";
import SocialLinks from "@/components/SocialLinks";

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <SEO
        title="About — Pakistani Casualty Tracker"
        description="Methodology, OSINT sources, and disclaimer for the independent Pakistani Casualty Tracker project."
        path="/about"
      />
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">About This Project</h1>
        <p className="mt-2 text-sm text-muted-foreground font-mono">
          Pakistani Casualty Tracker — an independent, volunteer-run OSINT project
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="pt-6 space-y-4 text-sm text-foreground/90 leading-relaxed">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <p>
              This is an <strong>independent, volunteer-run project</strong> with no funding or institutional backing.
              It is maintained by a small team in their spare time out of a commitment to transparency and accountability.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <p>
              Data entry and operational updates are maintained by the field monitoring team.
              Website development, maintenance, and technical operations are managed by the site owner.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Search className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <div className="space-y-2">
              <p>
                All data is gathered through <strong>Open Source Intelligence (OSINT)</strong>. Sources include:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">Khorasan Diary</strong> — considered an official-level source due to its reach and established credibility in tracking regional conflict data.</li>
                <li><strong className="text-foreground">ISPR official releases</strong> — statements from Pakistan's Inter-Services Public Relations.</li>
                <li><strong className="text-foreground">Social media (especially Facebook)</strong> — often the most reliable way to confirm individual casualties, as families and communities share tributes and funeral announcements.</li>
                <li>News articles, wire services, and other publicly available reporting.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-destructive shrink-0" />
            <p>
              <strong>Accuracy disclaimer:</strong> Not everything recorded here is guaranteed to be 100% accurate.
              This is volunteer work relying on open sources — errors in dates, locations, casualty counts, or attributions
              are possible. If you spot an inaccuracy, please reach out so it can be corrected.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
            <div className="space-y-2">
              <p>
                <strong>Third-party sources disclaimer:</strong> External sources linked on this site are operated independently and are included only as citations for public records.
              </p>
              <p>
                This project is <strong>not affiliated with, endorsed by, or responsible for</strong> the content posted on those external channels. We are an independent OSINT tracker and do not promote or condone propaganda from any side of the conflict.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <p>
              The goal is simple: to maintain a publicly accessible, as-complete-as-possible record of military and security force
              casualties in Pakistan from 2026 onwards.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <p>
              <strong>Coverage notes:</strong> Security force casualties and incidents are tracked from <strong>January 2026</strong>.
              Militant KIA is tracked from <strong>June 2026</strong> onwards, and economic attacks
              (infrastructure, vehicles, cell towers, pipelines) are tracked from <strong>September 2026</strong> onwards.
            </p>
          </div>
        </CardContent>
      </Card>

      <SocialLinks />
    </div>
  );
}
