import { ISocialLinks } from "./ISocialLinks";
import { IUser } from "./IUser";

export interface IPost {
	readonly id?: number;
	readonly createdAt: string;
	readonly mainPicture: string;
	readonly socialLinks: ISocialLinks | {};
	readonly header: string;
	readonly tag: string;
	readonly subHeader: string;
	readonly htmlContent: string;
	readonly user?: IUser;
	readonly hidden: boolean;
}