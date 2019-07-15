const LoginFormSelectors = {
    LoginForm: 'form[action="/sessions"]',
    LoginFormUsernameInput: 'input[name="session[username_or_email]"]',
    LoginFormPasswordInput: 'input[name="session[password]"]',
    LoginFormSubmit: 'div[role="button"]',
};

export default LoginFormSelectors;
