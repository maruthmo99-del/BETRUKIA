export default function HelpFAQ() {
  return (
    <div className="panel help-faq-panel">
      <div className="panel-header">
        <h2>Help / FAQ</h2>
      </div>
      <div className="help-faq-content">
        <p><strong>Need help? We've got you covered.</strong></p>
        <p>Browse answers to common questions about your account, deposits, withdrawals, and more. Can't find what you're looking for? Reach out to our support team directly:</p>
        <ul>
          <li><strong>Phone:</strong> 0722989898</li>
          <li><strong>Email:</strong> <a href="mailto:rugendo49@gmail.com" className="link">rugendo49@gmail.com</a></li>
        </ul>
        <p><strong>Sample FAQ topics to include:</strong></p>
        <ul>
          <li>How do I create an account?</li>
          <li>How do I deposit / withdraw funds?</li>
          <li>Why hasn't my withdrawal been processed?</li>
          <li>How do I reset my password?</li>
          <li>How do I verify my account?</li>
          <li>Who do I contact for further support?</li>
        </ul>
      </div>
    </div>
  );
}
