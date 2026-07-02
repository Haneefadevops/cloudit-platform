'use client'

import { DollarSign } from 'lucide-react'

interface OvertimePolicySettings {
  max_daily_hours: number
  max_weekly_hours: number
  weekday_rate: number
  weekend_rate: number
  holiday_rate: number
  requires_approval: boolean
  auto_detect: boolean
}

interface OvertimePolicySettingsProps {
  policy: OvertimePolicySettings
  onChange: (policy: OvertimePolicySettings) => void
}

export function OvertimePolicySettingsComponent({ policy, onChange }: OvertimePolicySettingsProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Overtime Policy
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure overtime rates and limits for your organization
        </p>

        <div className="space-y-6">
          {/* Overtime Limits */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Overtime Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Daily OT Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="8"
                  value={policy.max_daily_hours}
                  onChange={(e) => onChange({ ...policy, max_daily_hours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum overtime hours allowed per day
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Weekly OT Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="40"
                  value={policy.max_weekly_hours}
                  onChange={(e) => onChange({ ...policy, max_weekly_hours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum overtime hours allowed per week
                </p>
              </div>
            </div>
          </div>

          {/* Overtime Rates */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Overtime Rates (Multipliers)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekday Rate
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={policy.weekday_rate}
                    onChange={(e) => onChange({ ...policy, weekday_rate: parseFloat(e.target.value) || 1.5 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">× base pay</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Common: 1.5× (time and a half) for weekday overtime
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekend Rate
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={policy.weekend_rate}
                    onChange={(e) => onChange({ ...policy, weekend_rate: parseFloat(e.target.value) || 2.0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">× base pay</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Common: 2.0× (double time) for weekend work
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Holiday Rate
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={policy.holiday_rate}
                    onChange={(e) => onChange({ ...policy, holiday_rate: parseFloat(e.target.value) || 2.5 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">× base pay</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Common: 2.5× (double time and a half) for public holidays
                </p>
              </div>
            </div>
          </div>

          {/* Overtime Options */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Overtime Options</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.requires_approval}
                  onChange={(e) => onChange({ ...policy, requires_approval: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Require Manager Approval</span>
                  <p className="text-xs text-gray-500">
                    Overtime must be approved by a manager before being paid
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.auto_detect}
                  onChange={(e) => onChange({ ...policy, auto_detect: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Auto-Detect Overtime</span>
                  <p className="text-xs text-gray-500">
                    Automatically create overtime records when employees exceed shift hours
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Example Calculation */}
          <div className="bg-purple-50 border-l-4 border-purple-400 p-4">
            <h4 className="font-medium text-purple-900 mb-2">Example Overtime Calculation</h4>
            <div className="text-sm text-purple-700 space-y-1">
              <p>
                • Employee with LKR 1,000/hour base pay works 3 hours overtime on a weekday:
              </p>
              <p className="ml-4">
                → 3 hours × LKR 1,000 × {policy.weekday_rate}× = <strong>LKR {(3 * 1000 * policy.weekday_rate).toLocaleString()}</strong>
              </p>
              <p>
                • Same employee works 4 hours on a public holiday:
              </p>
              <p className="ml-4">
                → 4 hours × LKR 1,000 × {policy.holiday_rate}× = <strong>LKR {(4 * 1000 * policy.holiday_rate).toLocaleString()}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
