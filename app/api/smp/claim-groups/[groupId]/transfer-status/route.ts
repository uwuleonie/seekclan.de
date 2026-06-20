import { NextRequest, NextResponse } from 'next/server'
import { isGroupLockedByTransfer } from '@/app/lib/claim-transfer-lock'

// Liefert, ob für diese Gruppe aktuell eine offene Übertragungsanfrage existiert.
export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const locked = await isGroupLockedByTransfer(groupId)
  return NextResponse.json({ locked })
}