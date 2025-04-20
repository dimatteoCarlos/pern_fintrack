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

export type UserDataType = {
  userId: string | null;
  username: string;
  user_firstname: string;
  user_lastname: string;
  email: string;
};
//backend data response type
export type AuthResponseType={token:string, user:UserDataType; message?:string, error:string | null}
