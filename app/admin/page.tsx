'use client'

import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

export default function AdminPage() {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>

  if (!user || user.clan_role !== 'admin') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">🚫</p>
        <p className="text-gray-900 font-bold text-xl mb-2">Kein Zugriff</p>
        <p className="text-gray-500 mb-6">Du hast keine Berechtigung für diese Seite.</p>
        <Link href="/" className="btn-gradient text-white px-6 py-3 rounded-xl">Zur Startseite</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück</Link>

        <h1 className="text-3xl font-bold mb-2 text-gray-900">Admin</h1>
        <p className="text-gray-500 mb-8">Verwaltung der seekclan.de Website.</p>

        <div className="grid grid-cols-2 gap-4">
          <Link href="/admin/accounts" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4">👤</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Seek Accounts</h2>
            <p className="text-gray-500 text-sm">Alle registrierten Accounts, Login-Historie, Bans & Rollen.</p>
            <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
          </Link>

          <Link href="/admin/clan" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4">👥</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Clan-Mitglieder</h2>
            <p className="text-gray-500 text-sm">Minecraft-Namen, Rollen & Sortierung der Clanliste.</p>
            <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
          </Link>

          <Link href="/admin/badges" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-2xl mb-4">🎖️</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Clan-Abzeichen</h2>
            <p className="text-gray-500 text-sm">Abzeichen & Kategorien erstellen, Mitgliedern zuweisen.</p>
            <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
          </Link>

          <Link href="/admin/wm-spiele" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl mb-4">🏆</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">WM-Spiele</h2>
            <p className="text-gray-500 text-sm">Spiele anlegen, Anpfiff setzen, Ergebnisse pflegen.</p>
            <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
          </Link>

          <Link href="/admin/gast-sperren" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl mb-4">🚫</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Gast-Sperren</h2>
            <p className="text-gray-500 text-sm">Gast-Tipper sperren und Sperren verwalten.</p>
            <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
          </Link>

          <Link href="/admin/changelog" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-4">📢</div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Changelog</h2>
            <p className="text-gray-500 text-sm">Einträge erstellen, bearbeiten und löschen.</p>
            <span className="text-purple-500 text-sm mt-3 block group-hover:translate-x-1 transition-all">Öffnen →</span>
          </Link>
        </div>
      </div>
    </div>
  )
}