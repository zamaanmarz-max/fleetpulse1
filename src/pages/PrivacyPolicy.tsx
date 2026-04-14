import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: 14 April 2026</p>

        <div className="prose prose-sm prose-invert max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>MARZ Technologies (Pty) Ltd ("we", "us", "our") operates the MARZ Fleet platform at fleet.marzai.co.za. We are committed to protecting the personal information of our users in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and all applicable South African legislation.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p>We collect and process the following categories of personal information:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Identity Information:</strong> Full name, ID number, email address, phone number</li>
              <li><strong className="text-foreground">Employment Information:</strong> Employment status, role, branch assignment</li>
              <li><strong className="text-foreground">Driver Information:</strong> Licence details, PrDP details, medical certificates, criminal background checks, training records</li>
              <li><strong className="text-foreground">Vehicle Information:</strong> Registration numbers, VIN, odometer readings, service history, equipment details</li>
              <li><strong className="text-foreground">Compliance Records:</strong> Certificates, inspection reports, fines, AARTO demerit points</li>
              <li><strong className="text-foreground">Usage Data:</strong> Login timestamps, audit trail activities</li>
              <li><strong className="text-foreground">Uploaded Documents:</strong> PDFs, images of certificates and attendance sheets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Purpose of Processing</h2>
            <p>We process personal information for the following lawful purposes:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Fleet compliance management and monitoring</li>
              <li>Driver documentation and certification tracking</li>
              <li>Vehicle inspection and maintenance scheduling</li>
              <li>AARTO fine management and demerit tracking</li>
              <li>Regulatory compliance reporting (RTMC, C-NATIS, COF)</li>
              <li>User account management and authentication</li>
              <li>AI-powered fleet analysis and recommendations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. How We Secure Your Data</h2>
            <p>We implement appropriate technical and organisational measures to protect personal information:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>End-to-end encryption for data in transit (TLS 1.3)</li>
              <li>Encryption at rest for all stored data</li>
              <li>Row-Level Security (RLS) ensuring strict multi-tenant data isolation</li>
              <li>Role-based access control with organisation-level data segregation</li>
              <li>Secure file storage with time-limited signed URLs</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Audit logging of all data access and modifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Data Subject Rights</h2>
            <p>Under POPIA, you have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Right to Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong className="text-foreground">Right to Correction:</strong> Request correction of inaccurate or incomplete personal information</li>
              <li><strong className="text-foreground">Right to Deletion:</strong> Request deletion of your personal information, subject to legal retention requirements</li>
              <li><strong className="text-foreground">Right to Object:</strong> Object to the processing of your personal information</li>
              <li><strong className="text-foreground">Right to Complain:</strong> Lodge a complaint with the Information Regulator</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>We retain personal information for a period of <strong>5 (five) years</strong> from the date of last activity, or as required by applicable South African legislation (including the National Road Traffic Act and AARTO regulations). After the retention period, data is securely deleted or anonymised.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Third-Party Sharing</h2>
            <p>We do not sell, trade, or rent personal information to third parties. We may share data with:</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Cloud infrastructure providers (for hosting and storage) under strict data processing agreements</li>
              <li>Regulatory authorities when required by law</li>
              <li>AI service providers for fleet analysis (data is anonymised where possible)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Requesting Data Deletion</h2>
            <p>To request the deletion of your personal information, please email us at <a href="mailto:privacy@marztech.co.za" className="text-primary hover:underline">privacy@marztech.co.za</a> with the subject line "Data Deletion Request". Include your full name, email address, and organisation name. We will process your request within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Cookies and Analytics</h2>
            <p>MARZ Fleet uses essential cookies for authentication and session management. We do not use third-party advertising cookies. Analytics data is collected in aggregate form to improve the platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of the platform constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
            <p>For any privacy-related enquiries or to exercise your data subject rights:</p>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-1 text-sm">
              <p><strong className="text-foreground">Information Officer:</strong> MARZ Technologies (Pty) Ltd</p>
              <p><strong className="text-foreground">Email:</strong> <a href="mailto:privacy@marztech.co.za" className="text-primary hover:underline">privacy@marztech.co.za</a></p>
              <p><strong className="text-foreground">Website:</strong> fleet.marzai.co.za</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © 2026 MARZ Technologies (Pty) Ltd. All rights reserved.
        </div>
      </div>
    </div>
  );
}
