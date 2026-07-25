export {
  MailMessage,
  formatMailAddress,
  mailAddressValue,
  type MailAddress,
  type OutgoingMail,
} from "./MailMessage";
export {
  ArrayMailTransport,
  LogMailTransport,
  SmtpTransport,
  buildRfc822Message,
  createNodeSmtpConnection,
  normalizeOutgoingMail,
  smtpReplyHasCapability,
  takeSmtpReply,
  type MailTransport,
  type SmtpConnection,
  type SmtpConnector,
  type SmtpReply,
} from "./SmtpTransport";
export { MailManager, mail } from "./MailManager";
