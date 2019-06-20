import { ElementHandle } from 'puppeteer';

type UsernameField = ElementHandle<Element>;
type PasswordField = ElementHandle<Element>;
type SubmitButton = ElementHandle<Element>;

export default interface LoginForm {
    usernameField: UsernameField,
    passwordField: PasswordField,
    submitButton: SubmitButton
}
