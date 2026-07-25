import { useState } from "react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState("info");

  function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setMsgType("error");
      setMsg("Please fill in all fields");
      return;
    }

    if (!email.includes("@")) {
      setMsgType("error");
      setMsg("Please enter a valid email");
      return;
    }

    setMsgType("success");
    setMsg("Message sent! We'll get back to you within 24 hours.");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  return (
    <div className="panel contact-panel">
      <div className="panel-header">
        <h2>Help & Support</h2>
      </div>

      <div className="contact-content">
        <section className="contact-section">
          <h3>Help / FAQ</h3>
          <p><strong>Need help? We&apos;ve got you covered.</strong></p>
          <p>Browse answers to common questions about your account, deposits, withdrawals, and more. If you cannot find what you need, reach out to our support team directly.</p>
          <ul>
            <li><strong>Phone:</strong> 0722989898</li>
            <li><strong>Email:</strong> <a href="mailto:rugendo49@gmail.com" className="link">rugendo49@gmail.com</a></li>
          </ul>
          <p><strong>Sample FAQ topics:</strong></p>
          <ul>
            <li>How do I create an account?</li>
            <li>How do I deposit or withdraw funds?</li>
            <li>Why hasn&apos;t my withdrawal been processed?</li>
            <li>How do I reset my password?</li>
            <li>How do I verify my account?</li>
            <li>Who do I contact for further support?</li>
          </ul>
          <p><em>For &quot;Who do I contact&quot; — call us on 0722989898 or email rugendo49@gmail.com and our support team will respond promptly.</em></p>
        </section>

        <section className="contact-section">
          <h3>Responsible Gaming</h3>
          <p><strong>Play responsibly. We&apos;re here to help.</strong></p>
          <p>We are committed to promoting responsible gaming and ensuring a safe experience for all our users. If you feel your gaming habits are becoming a concern, we encourage you to act early.</p>
          <p><strong>Tools available to you:</strong></p>
          <ul>
            <li>Set deposit limits</li>
            <li>Set time-out or cool-off periods</li>
            <li>Self-exclude from the platform temporarily or permanently</li>
          </ul>
          <p><strong>Signs to watch for:</strong></p>
          <ul>
            <li>Spending more money or time than you intended</li>
            <li>Gaming to escape stress or personal problems</li>
            <li>Borrowing money to gamble</li>
          </ul>
          <p>If you or someone you know needs support, contact us confidentially:</p>
          <ul>
            <li><strong>Phone:</strong> 0722989898</li>
            <li><strong>Email:</strong> <a href="mailto:rugendo49@gmail.com" className="link">rugendo49@gmail.com</a></li>
          </ul>
        </section>

        <section className="contact-section">
          <h3>Delete Account</h3>
          <p><strong>Want to delete your account?</strong></p>
          <p>Account deletion is permanent and cannot be undone. Any remaining balance should be withdrawn before deletion. All personal data will be handled according to our Privacy Policy.</p>
          <p>To request account deletion, please contact us using one of the methods below and our team will guide you through the process and verify your identity:</p>
          <ul>
            <li><strong>Phone:</strong> 0722989898</li>
            <li><strong>Email:</strong> <a href="mailto:rugendo49@gmail.com" className="link">rugendo49@gmail.com</a></li>
          </ul>
        </section>

        <section className="contact-section">
          <h3>Send us a message</h3>
          <form onSubmit={handleSubmit} className="contact-form">
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="form-input"
            />
            <textarea
              placeholder="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="form-textarea"
              rows="5"
            />
            <button type="submit" className="form-submit-btn">
              Send Message
            </button>
          </form>
          {msg && <div className={`contact-msg ${msgType}`}>{msg}</div>}
        </section>
      </div>
    </div>
  );
}
