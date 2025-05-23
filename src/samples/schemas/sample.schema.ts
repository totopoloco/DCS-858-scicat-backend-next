import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiHideProperty } from "@nestjs/swagger";
import { Document } from "mongoose";
import { OutputAttachmentV3Dto } from "src/attachments/dto-obsolete/output-attachment.v3.dto";
import { OwnableClass } from "src/common/schemas/ownable.schema";
import { DatasetClass } from "src/datasets/schemas/dataset.schema";
import { v4 as uuidv4 } from "uuid";

export type SampleDocument = SampleClass & Document;

@Schema({
  collection: "Sample",
  toJSON: {
    getters: true,
  },
  timestamps: true,
})
export class SampleClass extends OwnableClass {
  /**
   * Globally unique identifier of a sample. This could be provided as an input value or generated by the system.
   */
  @Prop({ type: String, unique: true, required: true, default: () => uuidv4() })
  sampleId: string;

  @ApiHideProperty()
  @Prop({ type: String })
  _id: string;

  /**
   * The owner of the sample.
   */
  @Prop({ type: String, required: false })
  owner?: string;

  /**
   * A description of the sample.
   */
  @Prop({ type: String, required: false })
  description?: string;

  /**
   * The type of the sample.
   */
  @Prop({ type: String, required: false })
  type?: string;

  /**
   * The proposal ID associated with the sample.
   */
  @Prop({ type: String, required: false })
  proposalId?: string;

  /**
   * The Id of the parent sample if this is a derived sample.
   */
  @Prop({ type: String, required: false })
  parentSampleId?: string;

  /**
   * JSON object containing the sample characteristics metadata.
   */
  @Prop({ type: Object, required: false, default: {} })
  sampleCharacteristics?: Record<string, unknown> = {};
}

export class SampleWithAttachmentsAndDatasets extends SampleClass {
  /**
   * Attachments that are related to this sample.
   */
  // this property should not be present in the database model
  attachments?: OutputAttachmentV3Dto[];

  /**
   * Datasets that are related to this sample.
   */
  // this property should not be present in the database model
  datasets?: DatasetClass[];
}

export const SampleSchema = SchemaFactory.createForClass(SampleClass);

SampleSchema.index({ "$**": "text" });
