import Papa from 'papaparse'
import { Level, LEVELS, Student } from './types'

function toLevel(v: string | undefined): Level {
  const t = (v ?? '').trim()
  return (LEVELS as string[]).includes(t) ? (t as Level) : '중'
}

/** "이름" 또는 "이름,수준" / "이름<탭>수준" 줄 목록 → 학생들 */
export function parseRows(rows: string[][]): Student[] {
  const out: Student[] = []
  for (const r of rows) {
    const name = (r[0] ?? '').trim()
    if (!name || ['이름', 'name', '번호'].includes(name.toLowerCase())) continue
    // "1, 김하늘, 상" 처럼 번호가 먼저 오면 건너뛰기
    if (/^\d+$/.test(name) && r[1]) { out.push({ name: r[1].trim(), level: toLevel(r[2]) }); continue }
    out.push({ name: name.slice(0, 30), level: toLevel(r[1]) })
  }
  return out
}

/** 붙여넣기: 줄마다 쉼표·탭 어느 쪽이든 (엑셀에서 복사하면 탭) */
export function parsePasted(text: string): Student[] {
  const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(/[,\t]/))
  return parseRows(rows)
}

function parseCsvText(text: string): Student[] {
  const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true })
  return parseRows(res.data)
}

/** CSV 파일: UTF-8 먼저, 깨지면 EUC-KR(엑셀 한글 저장) */
export async function parseCsvFile(file: File): Promise<Student[]> {
  const buf = await file.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    text = new TextDecoder('euc-kr').decode(buf)
  }
  return parseCsvText(text.replace(/^﻿/, ''))
}
