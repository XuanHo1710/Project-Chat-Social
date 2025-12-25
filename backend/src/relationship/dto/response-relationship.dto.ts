export interface ResponseRelationshipDto {
  _id: string;
  firstName: string;
  lastName: string;
  gender: string;
  username: string;
  role: string;
  authProvider: string;
  status: string;
  isBlocked: boolean;
  isActive: boolean;
  time: Date;
}
