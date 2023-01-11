import * as Strategy from "passport-ldapauth";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "src/users/users.service";
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { CreateUserIdentityDto } from "src/users/dto/create-user-identity.dto";
import { FilterQuery } from "mongoose";
import { User, UserDocument } from "src/users/schemas/user.schema";
import { AccessGroupService } from "../access-group-provider/access-group.service";
import { UserPayload } from "../interfaces/userPayload.interface";
import { Profile } from "passport";
import { UserProfile } from "src/users/schemas/user-profile.schema";

@Injectable()
export class LdapStrategy extends PassportStrategy(Strategy, "ldap") {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private accessGroupService: AccessGroupService
  ) {
    super(configService.get<Record<string, unknown>>("ldap"));
  }

  async validate(
    payload: Record<string, unknown>,
  ): Promise<Omit<User, "password">> {
    const userFilter: FilterQuery<UserDocument> = {
      $or: [
        { username: `ldap.${payload.displayName}` },
        { email: payload.mail as string },
      ],
    };
    const userExists = await this.usersService.userExists(userFilter);

    if (!userExists) {
      const createUser: CreateUserDto = {
        username: `ldap.${payload.displayName}`,
        email: payload.mail as string,
      };
      const user = await this.usersService.create(createUser);

      if (!user) {
        throw new InternalServerErrorException(
          "Could not create User from LDAP response.",
        );
      }

      const userPayload: UserPayload = {
        userId : user.id as string,
        username : user.username,
        email: user.email
      }
      const accessGroups = await this.accessGroupService.getAccessGroups(userPayload);

      const createUserIdentity: CreateUserIdentityDto = {
        authScheme: "ldap",
        credentials: {},
        externalId: payload.sAMAccountName as string,
        profile: {
          displayName: payload.displayName as string,
          email: payload.mail as string,
          username: payload.displayName as string,
          thumbnailPhoto: payload.thumbnailPhoto
            ? "data:image/jpeg;base64," +
              Buffer.from(payload.thumbnailPhoto as string, "binary").toString(
                "base64",
              )
            : "error: no photo found",
          emails: [{ value: payload.mail as string }],
          accessGroups: accessGroups,
          id: payload.sAMAccountName as string,
        },
        provider: "ldap",
        userId: user._id,
      };

      await this.usersService.createUserIdentity(createUserIdentity);
    } 

    const foundUser = await this.usersService.findOne(userFilter);
    const jsonUser = JSON.parse(JSON.stringify(foundUser));
    const { password, ...user } = jsonUser;
    user.userId = user._id;

    // update user identity if needed
    if (userExists) {
      const userPayload: UserPayload = {
        userId : user.id as string,
        username : user.username,
        email: user.email
      }
      const userIdentity = await this.usersService.findByIdUserIdentity(user._id);
      let userProfile = userIdentity?.profile as UserProfile;
      userProfile.accessGroups = await this.accessGroupService.getAccessGroups(userPayload);
      await this.usersService.updateUserIdentity(
        {
          profile: userProfile,
        },
        user._id,
      );
    }

    return user;
  }

  getProfile(payload: Record<string, unknown>) {
    type ldapProfile = Profile & UserProfile;
    const profile = {} as ldapProfile;

    profile.displayName = payload.displayName as string;
    profile.email = payload.mail as string;
    profile.username = payload.displayName as string;
    profile.thumbnailPhoto = payload.thumbnailPhoto
      ? "data:image/jpeg;base64," +
        Buffer.from(payload.thumbnailPhoto as string, "binary").toString(
          "base64",
        )
      : "error: no photo found";
    profile.emails = [{ value: payload.mail as string }];
    profile.id = payload.sAMAccountName as string;
  };
}