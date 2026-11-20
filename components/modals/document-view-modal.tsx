"use client";

import { Button } from "@/components/ui/button";
import ModalDocumentView from "../ui/modal-document-view";
import { OpenStoredFile } from "@/components/files/OpenStoredFile";
import { fileLaunch } from "@/lib/documents/open-file";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  document: any;
}

const DocumentViewModal = ({
  isOpen,
  onClose,
  loading,
  document,
}: AlertModalProps) => {

  const imageTypes = [
    "application/png",
    "application/jpg",
    "application/jpeg",
    "application/gif",
    "images/png",
    "images/jpg",
    "images/jpeg",
    "images/gif",
    "image/png",
    "image/jpg",
    "image/jpeg",
    "image/gif",
    "image/webp",
  ];

  // The file itself opens in a new tab. This dialog only holds that link.
  const launch = fileLaunch(document.document_name ?? "", document.document_file_mimeType);
  const image = launch === "image" || imageTypes.includes(document.document_file_mimeType);

  return (
    <ModalDocumentView isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col h-full ">
        <OpenStoredFile
          kind="document"
          id={document.id}
          name={document.document_name ?? "bestand"}
          mimeType={document.document_file_mimeType}
          image={image}
          className="underline"
        >
          {document.document_name}
        </OpenStoredFile>
        <div className="pt-6 space-x-2 flex items-center justify-end w-full ">
          <Button disabled={loading} variant={"outline"} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </ModalDocumentView>
  );
};

export default DocumentViewModal;
