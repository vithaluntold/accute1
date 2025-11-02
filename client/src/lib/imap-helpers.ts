export class ImapEmailService {
  static encryptPassword(password: string, email: string): string {
    return JSON.stringify({ user: email, pass: password });
  }
}
