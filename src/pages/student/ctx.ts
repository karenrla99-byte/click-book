import { createContext, useContext } from 'react'
import { FlatCard, Template } from '../../lib/template'
import { Project } from '../../lib/store'
import { Student } from '../../lib/types'

export type StudentCtx = {
  code: string
  room: { id: string; code: string; name: string }
  me: Student
  template: Template
  cards: FlatCard[]
  project: Project
  ns: string
  update: (fn: (p: Project) => Project) => void
  assetUrl: (path: string | null | undefined) => Promise<string | undefined>
  go: (step: Step) => void
}
export const STEPS = ['view', 'shoot', 'connect', 'greet', 'preview', 'send'] as const
export type Step = (typeof STEPS)[number]

export const Ctx = createContext<StudentCtx | null>(null)
export const useStudent = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('no student ctx')
  return c
}
