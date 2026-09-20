import type { Topic } from '../api/types'
import { Badge, Card, buttonClasses } from './ui'
import { Link } from 'react-router-dom'
import { LevelMeter } from './LevelMeter'
import { bandTone, percent } from '../lib/format'

/**
 * One topic tile.
 *
 * The link carries the chosen year group as well as the topic, so the set is dealt from the year
 * the student picked rather than whatever is remembered by the time the quiz page loads. It
 * carries no question count: the set is a sample drawn at the student's level, so how many
 * questions the bank holds is not how many they will be asked. It is the level that decides
 * which questions come back.
 */
export function TopicCard({
  topic,
  yearGroup,
  accuracy,
  level,
}: {
  topic: Topic
  yearGroup: number
  accuracy?: number
  level?: number
}) {
  const href = `/quiz?topic=${encodeURIComponent(topic.slug)}&year=${yearGroup}`
  // One colour for the card, and it is the band's, not the percentage's: the badge and the meter
  // then always agree with each other and with the word underneath them.
  const tone = level === undefined ? null : bandTone(level)

  return (
    <Card className="flex flex-col p-5 transition hover:shadow-md hover:ring-indigo-200">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{topic.name}</h3>
        {tone ? (
          <Badge tone={tone}>{percent(accuracy ?? 0)}</Badge>
        ) : (
          <Badge tone="indigo">New</Badge>
        )}
      </div>

      {topic.description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{topic.description}</p>
      ) : null}

      {level !== undefined ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Working at</p>
          <LevelMeter level={level} tone={tone ?? undefined} className="mt-1.5" />
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-end pt-5">
        <Link to={href} className={buttonClasses('primary', 'sm')}>
          Practise
        </Link>
      </div>
    </Card>
  )
}
