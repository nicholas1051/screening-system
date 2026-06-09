export default function TermsOfService({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-slate-900 flex items-start justify-center p-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="card-glass p-8 sm:p-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Terms of Service</h1>
              <p className="text-slate-400 text-sm mt-1">Last updated: June 2026</p>
            </div>
            <button onClick={onBack}
              className="text-sm text-accent-400 hover:text-accent-300 font-medium transition-colors">
              &larr; Back
            </button>
          </div>

          <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
              <p>By accessing or using the University of Abuja Online Departmental Student Screening System (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Description of Service</h2>
              <p>The Platform provides a digital workflow for student clearance screening, document verification, and admission analytics. It is operated by the University of Abuja for official academic purposes.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. User Accounts & Responsibilities</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                <li>You must provide accurate and complete information during registration and use.</li>
                <li>You may not share your account or allow unauthorised access.</li>
                <li>You are responsible for all activity occurring under your account.</li>
                <li>Notify the university immediately of any unauthorised use of your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">4. Acceptable Use</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Use the Platform only for lawful, legitimate clearance-related activities.</li>
                <li>Do not upload false, misleading, or fraudulent documents.</li>
                <li>Do not attempt to bypass security, access another user&rsquo;s data, or disrupt service.</li>
                <li>Do not use automated scripts, scrapers, or bots without written authorisation.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">5. Data Privacy</h2>
              <p>Your personal data is processed in accordance with the University of Abuja Data Privacy Policy and the Nigeria Data Protection Regulation (NDPR). We collect, store, and process only the data necessary for clearance and academic record-keeping.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">6. Document Submission & Verification</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Students are responsible for uploading authentic, legible documents.</li>
                <li>The university reserves the right to reject or query any document found to be fraudulent, illegible, or non-compliant.</li>
                <li>Submission of a document does not guarantee clearance; verification is at the discretion of authorised officers.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">7. Intellectual Property</h2>
              <p>The Platform, including its design, code, branding, and content, is the intellectual property of the University of Abuja. You may not reproduce, modify, or distribute the Platform without prior written consent.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">8. Limitation of Liability</h2>
              <p>The University of Abuja is not liable for any indirect, incidental, or consequential damages arising from the use or inability to use the Platform, including but not limited to loss of data, delays in clearance, or system downtime.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">9. Termination</h2>
              <p>The university reserves the right to suspend or terminate access to the Platform at any time without prior notice for violations of these terms, suspected fraud, or administrative requirements.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">10. Changes to Terms</h2>
              <p>These Terms may be updated periodically. Continued use of the Platform after changes constitutes acceptance of the revised terms. Users will be notified of material changes via the Platform or registered email.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">11. Governing Law</h2>
              <p>These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be subject to the jurisdiction of the courts of the Federal Capital Territory, Abuja.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">12. Contact</h2>
              <p>For questions or concerns regarding these Terms, contact the University of Abuja IT Support at <span className="text-accent-400">it.support@uniabuja.edu.ng</span>.</p>
            </section>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">&copy; 2026 University of Abuja. All rights reserved.</p>
            <button onClick={onBack}
              className="px-6 py-2.5 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-accent-500/25 hover:shadow-accent-500/40 active:scale-[0.97]">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
