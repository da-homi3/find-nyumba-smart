import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { copyTextToClipboard } from "@/lib/share-listing";
import {
  PLATFORM_PROFILE_COPY,
  buildWeek1PublishPack,
  type PlatformProfileCopy,
  type Week1SocialPost,
} from "@/lib/social/profile-copy";

async function copyField(label: string, value: string) {
  const ok = await copyTextToClipboard(value);
  if (!ok) {
    toast.error(`Could not copy ${label}`);
    return false;
  }
  toast.success(`${label} copied`);
  return true;
}

function CopyChip({ label, value }: Readonly<{ label: string; value: string }>) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void copyField(label, value).then((ok) => {
          if (!ok) return;
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
    >
      {done ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function ProfileCard({ profile }: Readonly<{ profile: PlatformProfileCopy }>) {
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold">{profile.platform}</h3>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open profile <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CopyChip label="Name" value={profile.displayName} />
          <CopyChip label="Bio" value={profile.bio} />
          <CopyChip label="Website" value={profile.website} />
          {profile.pinnedPost ? <CopyChip label="Pinned post" value={profile.pinnedPost} /> : null}
        </div>
      </div>
      <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
        <div>
          <dt className="font-semibold text-foreground">Display name</dt>
          <dd className="mt-0.5">{profile.displayName}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Bio</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">{profile.bio}</dd>
        </div>
        {(profile.notes ?? []).length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {profile.notes?.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </dl>
    </article>
  );
}

function Week1Card({ post }: Readonly<{ post: Week1SocialPost }>) {
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Day {post.day} · {post.pillar}
          </p>
          <h3 className="mt-1 font-display text-sm font-semibold">{post.topic}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Keyword: {post.targetKeyword}</p>
        </div>
        <CopyChip label="Caption" value={post.caption} />
      </div>
      <p className="mt-2 text-xs font-medium text-foreground">{post.hook}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Platforms: {post.platforms.join(" · ")}
      </p>
      <a
        href={post.destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Destination <ExternalLink className="h-3 w-3" />
      </a>
    </article>
  );
}

/** Admin Social SEO ops — one-click copy for bios, pins, and Week 1 posts. */
export function AdminSocialSeoTab() {
  const week1 = buildWeek1PublishPack();
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-lg font-semibold">Profile setup</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Open each profile, then copy Name / Bio / Website / Pinned post. We cannot log into social
          apps from this dashboard — paste here after you are signed in on your phone or browser.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {PLATFORM_PROFILE_COPY.map((p) => (
            <ProfileCard key={p.platform} profile={p} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Week 1 publish pack</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Seven searchable posts (area guides + discovery). Film a short Reel/TikTok, paste the
          caption, and link the destination URL.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {week1.map((post) => (
            <Week1Card key={post.day} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
