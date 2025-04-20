export type CredentialsType = {
  username: string;
  email: string;
  user_firstname: string;
  user_lastname: string;
  password: string;
};

export interface SignInCredentialsType {
  username?: string;
  email?: string;
  password: string;
}
export interface SignUpCredentialsType extends SignInCredentialsType {
  user_firstname: string;
  user_lastname: string;
}
