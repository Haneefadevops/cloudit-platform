// Email service for sending payslip notifications
// Uses Resend API (https://resend.com)
// Set RESEND_API_KEY in your environment variables

interface SendPayslipEmailParams {
  to: string
  employeeName: string
  month: string
  year: number
  grossSalary: number
  netSalary: number
  totalDeductions: number
}

export async function sendPayslipEmail(params: SendPayslipEmailParams) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip - ${params.month} ${params.year}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">TouchOrbit</h1>
    <p style="color: #e9d5ff; margin: 10px 0 0 0;">Payslip for ${params.month} ${params.year}</p>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear ${params.employeeName},</p>

    <p>Your payslip for ${params.month} ${params.year} is now available.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin-top: 0; color: #9333ea; font-size: 18px; border-bottom: 2px solid #e9d5ff; padding-bottom: 10px;">Salary Summary</h2>

      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #6b7280;">Gross Salary</td>
          <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #1f2937;">
            LKR ${params.grossSalary.toLocaleString()}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 0; color: #6b7280;">Total Deductions</td>
          <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #dc2626;">
            -LKR ${params.totalDeductions.toLocaleString()}
          </td>
        </tr>
        <tr style="background: #f0fdf4; border-bottom: 2px solid #22c55e;">
          <td style="padding: 15px 10px; font-weight: bold; color: #166534;">Net Salary</td>
          <td style="padding: 15px 10px; text-align: right; font-weight: bold; font-size: 20px; color: #16a34a;">
            LKR ${params.netSalary.toLocaleString()}
          </td>
        </tr>
      </table>
    </div>

    <p style="margin-top: 25px;">To view your complete payslip with detailed breakdown, please log in to the employee portal:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_EMPLOYEE_APP_URL || 'https://employee.touchorbit.com'}/payslips"
         style="display: inline-block; background: #9333ea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        View Payslip
      </a>
    </div>

    <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Note:</strong> This email contains confidential salary information. Please do not forward or share this email.
      </p>
    </div>

    <p style="margin-top: 25px; font-size: 14px; color: #6b7280;">
      If you have any questions about your payslip, please contact your HR department.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
      This is an automated email from TouchOrbit. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim()

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'TouchOrbit <noreply@touchorbit.com>',
        to: [params.to],
        subject: `Your Payslip - ${params.month} ${params.year}`,
        html: emailHtml,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Email send failed:', error)
      return { success: false, error: 'Failed to send email' }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: 'Email service error' }
  }
}

export async function sendBulkPayslipEmails(payslips: SendPayslipEmailParams[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const payslip of payslips) {
    const result = await sendPayslipEmail(payslip)
    if (result.success) {
      results.success++
    } else {
      results.failed++
      results.errors.push(`${payslip.employeeName}: ${result.error}`)
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}
