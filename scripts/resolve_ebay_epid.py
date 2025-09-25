#!/usr/bin/env python3
"""Resolve the eBay EPID for specific products."""

import asyncio
import csv
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Ensure the project root is on the import path when running as a script
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import selectinload  # noqa: E402

from core.database import SessionLocal  # noqa: E402
from core.models.catalog import Product  # noqa: E402
from core.services.ebay_api_client import EbayAPIClient  # noqa: E402
from core.services.ebay_product_resolver import (
    EbayProductResolver,
    ProductSearchInput,
)  # noqa: E402


@dataclass(slots=True)
class ProductRecord:
    id: uuid.UUID
    clean_name: str | None
    number: str | None
    set_code: str | None


async def resolve_epid_for_product(
    product: ProductRecord, api_client: EbayAPIClient | None = None
) -> tuple[str, str, str, str | None, str]:
    """Resolve the eBay EPID for the given product and return a status tuple."""
    close_client = False
    if api_client is None:
        api_client = EbayAPIClient()
        close_client = True

    resolver = EbayProductResolver(api_client)
    product_id_str = str(product.id)
    clean_name = product.clean_name or ""
    number = product.number or ""

    try:
        search_input = ProductSearchInput(
            clean_name=product.clean_name,
            number=product.number,
            set_code=product.set_code,
        )
        epid = await resolver.resolve(search_input)

        if epid:
            return product_id_str, clean_name, number, epid, "success"
        return product_id_str, clean_name, number, None, "no_epid_found"
    except Exception as exc:
        return product_id_str, clean_name, number, None, f"error: {exc}"
    finally:
        if close_client:
            await api_client.close()


async def batch_resolve_epids(
    product_ids: list[uuid.UUID], output_file: str, concurrent_limit: int = 10
) -> None:
    """Resolve EPIDs for multiple products and persist successful matches."""

    if not product_ids:
        print("No product IDs provided; nothing to resolve.")
        return

    product_records = _load_products(product_ids)
    api_client = EbayAPIClient()
    semaphore = asyncio.Semaphore(concurrent_limit)

    async def resolve_with_limit(
        product_id: uuid.UUID,
    ) -> tuple[str, str, str, str | None, str]:
        product = product_records.get(product_id)
        if product is None:
            return str(product_id), "", "", None, "product_not_found"
        async with semaphore:
            return await resolve_epid_for_product(product, api_client)

    print(
        f"Resolving {len(product_ids)} products (max concurrency={concurrent_limit})..."
    )

    try:
        results = await asyncio.gather(
            *(resolve_with_limit(pid) for pid in product_ids),
            return_exceptions=True,
        )
    finally:
        await api_client.close()

    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    success_count = 0
    with open(output_file, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["product_id", "clean_name", "product_number", "epid"])

        for original_pid, result in zip(product_ids, results):
            if isinstance(result, Exception):
                print(f"Error resolving {original_pid}: {result}")
                record = product_records.get(original_pid)
                product_id_str = str(original_pid)
                clean_name = record.clean_name if record and record.clean_name else ""
                number = record.number if record and record.number else ""
                writer.writerow([product_id_str, clean_name, number, "NULL"])
                continue

            product_id_str, clean_name, number, epid, status = result

            if status == "success" and epid:
                writer.writerow([product_id_str, clean_name, number, epid])
                print(f"Resolved {product_id_str}: {epid}")
                success_count += 1
            elif status == "product_not_found":
                print(f"Product not found: {product_id_str}")
                writer.writerow([product_id_str, clean_name, number, "NULL"])
            elif status == "no_epid_found":
                print(f"No EPID found for {product_id_str} ({clean_name})")
                writer.writerow([product_id_str, clean_name, number, "NULL"])
            else:
                print(f"Unable to resolve {product_id_str}: {status}")
                writer.writerow([product_id_str, clean_name, number, "NULL"])

    print(f"\nSaved {success_count} EPIDs to {output_file}")
    print(f"Processed {len(product_ids)} products total")


def get_hardcoded_product_ids() -> list[uuid.UUID]:
    """Return the hardcoded list of product IDs to process."""
    product_id_strings = [
        "067e8e41-3096-7b87-8000-a9f65de90661",
        "067820de-f4b6-7d86-8000-3e5c74ca1d05",
        "067e8e42-07fb-7656-8000-4073a3bfc154",
        "067e8e42-07fb-770e-8000-7cb9677562de",
        "067e8e39-3a42-74c4-8000-b7e0313194cc",
        "067820e1-de11-744c-8000-6b098807de1c",
        "067bacc6-4588-71a1-8000-19647607e477",
        "067e8e39-a054-73e1-8000-de5804303026",
        "067820dc-647d-78f0-8000-f04b114d4130",
        "067e8e39-a054-74cb-8000-3d8753708dfd",
        "067e8e39-a054-7541-8000-e35ecfe51e18",
        "067931e6-daba-7138-8000-2537bbf73b6a",
        "067820dd-045c-7af2-8000-0bf0f981cf46",
        "0689ee95-6cdc-7688-8000-673d6c6c7f7e",
        "067e8e44-95fc-7a75-8000-d0cefc63505a",
        "068cbbc7-6bcd-74e2-8000-1a6ff91f183e",
        "067820de-4064-7702-8000-6a55f1feaa50",
        "067820de-4064-7bec-8000-3cf597c7dfdc",
        "067820de-4064-7e05-8000-f0441e8fb458",
        "067820dc-7000-7abf-8000-c042c57f0382",
        "067820de-4065-7321-8000-4fb7acf8259f",
        "067820de-4065-75c0-8000-e20d777e94b4",
        "067e8e42-a081-75c2-8000-3d2461e7f140",
        "067820e2-8326-70c3-8000-7a067bfc28e7",
        "067820e3-25b7-7de9-8000-267693a098ae",
        "067820de-4065-7753-8000-788802fce641",
        "067820de-4065-78b3-8000-8bef6b62831f",
        "067820de-9415-7853-8000-7b832bee372b",
        "067e8e42-07fb-7752-8000-f8c016c78659",
        "067e8e3a-f151-70c2-8000-ab805e2b0aaf",
        "067e8e42-07fb-7795-8000-1756dbb747c7",
        "067820de-9415-795f-8000-8d59e1a4bb41",
        "067820de-9415-7992-8000-68a9f2da7e35",
        "067820de-9415-79b3-8000-d207210a4d65",
        "067820de-df35-7d9a-8000-0ffd7b425815",
        "067e8e3b-8e80-7baa-8000-48394dc2867a",
        "067820db-a506-7d71-8000-0c8acc0e052b",
        "067820db-a506-7db5-8000-601b62d15b0d",
        "067820de-c9c5-7ec3-8000-f80fd6818d25",
        "067e8e3d-9405-7692-8000-9348010e69bf",
        "067e8e4b-0f68-7512-8000-ba4a0188fbc0",
        "067820de-c9c5-7fd0-8000-64b6df3aa48c",
        "067e8e4a-e41f-72ba-8000-b06e0c67831c",
        "067e8e3a-3334-73fa-8000-e1809d4aa07c",
        "067e8e3b-c2cf-71e4-8000-cc36bb6e8024",
        "067820de-c9c7-7182-8000-0d7e78d8ec4c",
        "067e8e46-31a8-76f8-8000-308abb29ca07",
        "067820de-c9c7-76af-8000-dac58d31f0ce",
        "067e8e42-a081-757e-8000-40458d53e22e",
        "068760b0-ebc2-7e3f-8000-ff0cc39f0007",
        "068b9478-8bf2-7413-8000-ebd2887daa07",
        "067e8e42-a5ed-78c2-8000-7573878cf81e",
        "067820db-e210-71d1-8000-78c8d9a09feb",
        "067e8e42-a8b1-7bbc-8000-13eec50dbcc0",
        "067820e0-129b-78dc-8000-fbd9af1a623e",
        "067e8e3e-bbad-730f-8000-ebd569c7fdd6",
        "067820e3-1cd4-7a5d-8000-ca0145bc0a53",
        "067820db-f48d-7ef4-8000-c6024a0596f1",
        "067820db-f48d-7f15-8000-d89beeecd2b0",
        "067e8e43-f8da-7272-8000-c21c946610b0",
        "067e8e42-d828-76b5-8000-39e4279b1b11",
        "067820db-f48e-70eb-8000-f1be08850a6f",
        "067820db-f48e-710c-8000-4af1104cbfa1",
        "067820db-f48e-754f-8000-1b2f527060ae",
        "067820db-f48e-7581-8000-cb1626841a75",
        "067820db-f48e-75c4-8000-b27280a1caa7",
        "067e8e3b-39c8-74e8-8000-01932ed2fdd2",
        "067820de-c2a9-7691-8000-366122a27cac",
        "067820db-de31-7cb8-8000-be35fc768fa1",
        "067820dc-72cf-7440-8000-72e0a44b3203",
        "067820db-f48d-7c76-8000-a241d566d26a",
        "067820db-f48d-7d0d-8000-343ab1adb758",
        "067820db-f48d-7d3f-8000-81549b8ace22",
        "067820db-f48d-7d72-8000-c1e84702d6cb",
        "067820db-f48d-7d93-8000-8870e9f65a33",
        "067820db-f48d-7de7-8000-1ec6034be34c",
        "067820db-f48d-7e2a-8000-402407d47db6",
        "067820db-f48d-7e5d-8000-f4df5f785679",
        "067820db-f48d-7e7e-8000-138a92eb08c3",
        "067820db-f48d-7ea0-8000-618a0ac0a706",
        "067820db-f48d-7ec1-8000-fcaae513d1b9",
        "067820db-f48d-7f37-8000-88c98b922abb",
        "067820db-f48d-7f58-8000-eda1364e0be1",
        "067820db-f48d-7f7a-8000-fc74d9af0999",
        "067820db-f48d-7fac-8000-96a0c8b09e24",
        "067820db-f48d-7fef-8000-a31c67c688df",
        "067820db-f48e-7011-8000-de4b2944de0d",
        "067820db-f48e-7043-8000-b1feee98796b",
        "067820db-f48e-7065-8000-44b3546f92bb",
        "067820db-f48e-70c9-8000-b19b127b2f72",
        "067820db-f48e-713f-8000-882aaedb59b0",
        "067820db-f48e-7160-8000-07fd77ad9b10",
        "067820db-f48e-7182-8000-af8586a899d7",
        "067820db-f48e-71a3-8000-cb97bf7da709",
        "067820db-f48e-71d6-8000-437a4e351230",
        "067820db-f48e-7219-8000-05af4c1509cc",
        "067820db-f48e-72b0-8000-b90f0bc1cc76",
        "067820db-f48e-72d1-8000-cbb42cf98865",
        "067820db-f48e-7325-8000-fcdf98993717",
        "067820db-f48e-7347-8000-88f29cf784e3",
        "067820db-f48e-7368-8000-c8bc6bc15a03",
        "067820db-f48e-73ac-8000-ab8d9c10ad69",
        "067820db-f48e-73de-8000-0b081d8ecbf5",
        "067820db-f48e-73ff-8000-83886fa273e1",
        "067820db-93e3-7150-8000-c137292fddc5",
        "067820db-93e3-7433-8000-bb089f16911b",
        "067820db-f48e-7421-8000-07c66c31d6ad",
        "067820db-f48e-7443-8000-f63021fae79b",
        "067820db-f48e-7475-8000-af1c66690a70",
        "067820db-f48e-7496-8000-7ffbe7555731",
        "067820db-f48e-74b8-8000-dc1352b69bdf",
        "067820db-f48e-74da-8000-77964cfbf5f6",
        "067820db-f48e-750c-8000-b866484301bf",
        "067820db-f48e-752d-8000-c3c39011e3e5",
        "067820db-f48e-75a3-8000-8c84c7f2d1b1",
        "067820db-f48e-75e6-8000-21438f0ef6c9",
        "067820e2-94a3-79c5-8000-3f8ad597a485",
        "067820d9-fb03-7c6c-8000-541377795918",
        "067820dc-ea68-75b9-8000-510943d11d21",
        "067820e0-90fa-7472-8000-112ea337b3aa",
        "068649e4-361a-72b8-8000-2400de30fd69",
        "067820db-501b-7fce-8000-3aff26d81019",
        "067820db-a506-75f9-8000-4bc587acecea",
        "067820dc-0526-74a1-8000-7452cfc71f92",
        "067820e0-971b-7ee3-8000-bb75380285ee",
        "067820dd-757e-7889-8000-471e7d2160b2",
        "067820dd-757e-78ab-8000-86c0816ee256",
        "067820dd-757e-78dd-8000-2ee42e0c8e2e",
        "067820dd-e02e-7e0f-8000-f6133f5e7f5a",
        "067820dd-e02f-7427-8000-0c20ad141098",
        "067820dc-a1f4-7e11-8000-8c5bfbba960c",
        "067820e3-43ab-756f-8000-28075629c866",
        "067e8e44-1136-7188-8000-98abbc3a5923",
        "067e8e44-1136-75fd-8000-05ebc7a1cb0a",
        "067820dd-e02f-789c-8000-40ced111ed8a",
        "067820de-3551-71be-8000-122aa5f862a7",
        "067820de-3551-72db-8000-2de3c06b4803",
        "067820dc-a1f5-73f7-8000-e3fa35835995",
        "067e8e43-b2b7-7a80-8000-1e622a7b5ae6",
        "067e8e43-b2b7-7a91-8000-ed52d9b20239",
        "067e8e43-b2b7-7ab3-8000-6e6538c0667b",
        "067820de-dd6d-76dc-8000-04e841e446b8",
        "067e8e44-1780-713e-8000-7a87f7b4a0d0",
        "067e8e44-6b95-7896-8000-6b2d333a5999",
        "067e8e44-95fd-73f5-8000-0483b0776091",
        "067e8e44-95fd-745a-8000-e5f745cf3083",
        "067820dd-c670-7435-8000-764c0287ba39",
        "067820dd-c671-710e-8000-8a832eadb9bc",
        "067e8e37-f861-7f8e-8000-7720799d7806",
        "067e8e37-f861-7fc0-8000-2747fa595841",
        "067e8e38-85ac-7a03-8000-c57db4b3ee8c",
        "067e8e37-ee1b-723d-8000-21d97216dd1b",
        "067e8e39-74f6-77e4-8000-2612ec99a781",
        "067e8e39-3392-7fd3-8000-b1701464d6f9",
        "067820da-2c5c-7c53-8000-9e1ae4cae477",
        "067820da-2c5c-7c85-8000-fa2fe3a03260",
        "067820dc-0267-7781-8000-8c2782184e5f",
        "067820dc-0267-78e1-8000-00c328c79057",
        "067820dc-0267-7913-8000-0684560090e0",
        "067820db-ecaf-7d00-8000-1faac80c92c3",
        "067820db-ecaf-7d32-8000-5c93fa25e6cf",
        "067820dc-5983-7137-8000-cb3fa5219eb7",
        "067820dc-9ea8-76d7-8000-8ea2fcce20c5",
        "067820dc-9ea8-787a-8000-96eb17d31eaa",
        "067820dc-9ea8-789c-8000-48a4601894ca",
        "067820dc-9ea8-78ce-8000-eaf8281ef0ea",
        "067820d9-ee16-794c-8000-3a2a67d5f593",
        "067820dc-f51c-7f56-8000-0ed273d56e0e",
        "067820da-6478-763b-8000-d2484f094002",
        "067820da-6478-7a6d-8000-2f5cf3af5dbb",
        "067820dd-52ec-7bc8-8000-e8a04de336a4",
        "067820dd-52ec-7c5f-8000-64fab600f49d",
        "067820d9-f7df-7eeb-8000-31f52c3c9301",
        "067820db-7e43-7ec8-8000-1011cf1783fa",
        "067820db-344c-739f-8000-8e9b5576640e",
        "067820dc-a85f-7277-8000-eda9a5f3c57a",
        "067820da-7d71-7e29-8000-b4151cbe2793",
        "067820da-7d71-7e5c-8000-a3eae0e9e0e3",
        "067820da-7d71-7e8e-8000-aa1633cb4518",
        "067820da-fba6-799c-8000-ec3811789bfd",
        "067820db-523e-71b8-8000-f8ca3fafed1b",
        "067820da-74c2-77a6-8000-0f352c092240",
        "067820db-344d-70dc-8000-066fb4b4323e",
        "067820da-6d46-7f04-8000-a8f161a612f3",
        "067820da-f1e9-7dc7-8000-48a272170276",
        "067820da-f1e9-7ed3-8000-f407d8c1878d",
        "067820da-f1e9-7f6a-8000-bc956e0a18be",
        "067820db-e664-7f54-8000-333e0403f80c",
        "068760b0-3ece-7d15-8000-4d512a428cc3",
        "067820dc-492c-715d-8000-18fb9bf85fa7",
        "067820dc-9230-789a-8000-f985b74c17ff",
        "067e8e49-7ae5-7204-8000-4e8e80b7a06b",
        "067820df-2d94-7e4c-8000-09b937907b11",
        "067820df-2d94-7e7e-8000-050f754eb31e",
        "067e8e4b-856d-7d48-8000-5e6f61afda76",
        "067820dc-b699-72fb-8000-0fbed2cf1ffa",
        "067820dc-b699-7381-8000-41e1c58ff693",
        "067820dc-a547-78b7-8000-b8c22209ffc5",
        "067820dd-0db6-7987-8000-680ab5c5a031",
        "067820dd-0db6-79a9-8000-fe9d67e47b9f",
        "067e8e47-ec77-7a4e-8000-32776ca69d6b",
        "067820dd-819b-7bf0-8000-54174d1c556c",
        "067e8e3e-74a4-7367-8000-267719913f23",
        "067e8e3e-74a4-73aa-8000-e5e976230df0",
        "067820dd-e662-7be0-8000-b673e60da324",
        "067820da-6d48-73ec-8000-b0477e0c39fe",
        "067820da-2c5c-7ca7-8000-ace87ddb38a8",
        "067e8e3d-3d47-71e6-8000-ec006b057109",
        "067e8e3d-3d47-7208-8000-14dd5fc47de7",
        "067820df-a45b-76e5-8000-15c076ff55ee",
        "067820de-faa9-761c-8000-56f11dbc2dd1",
        "067820dd-b566-771e-8000-4fd2da9c3d71",
        "067820dc-b699-70e2-8000-4b131de67287",
        "067820df-e871-7c10-8000-d9e95f4b7fca",
        "067820df-e871-7cda-8000-f9b2b8b5dbd3",
        "067820e2-fffe-7942-8000-8e245ed10488",
        "067820db-0e45-71da-8000-adf44ad969b1",
        "067820db-0e45-737e-8000-096c54f756b6",
        "067e8e47-2c28-746a-8000-5b27018e09f7",
        "067820dd-9907-76f2-8000-1b2771bfb304",
        "067e8e3f-1d74-71f2-8000-672fb7bff06f",
        "067e8e46-417d-7c16-8000-682e95e80f92",
        "067e8e46-417d-7d00-8000-76262012d4de",
        "067e8e39-805d-7d2a-8000-1d2b156b2340",
        "067820d9-ea03-7ed9-8000-1e74d7e3eab7",
        "067820db-f48e-71f7-8000-6624a0401ddb",
        "067820db-f48e-725c-8000-0b542521cb32",
        "067820db-f48e-728e-8000-922053390869",
        "067820db-f48e-72f3-8000-97d40a8aab07",
        "067820db-f48e-738a-8000-2a6f5d4f0320",
        "067e8e3f-2a19-7a52-8000-1e28320ca22e",
        "067e8e3f-2a19-7a95-8000-16003f9c0880",
        "067e8e3f-2a19-7ad8-8000-7122df874a0e",
        "067e8e3f-2a19-7b0a-8000-cc5feb71e120",
        "067820dc-f2e8-7858-8000-9d293d2347fd",
        "067820dc-f2e8-787a-8000-57aeee4ccae6",
        "067820dc-f2e8-7ab4-8000-c0412aa29417",
        "067820de-3c5a-7997-8000-3a1683f2d933",
        "067820de-3c5a-7b7d-8000-24625d063ec9",
        "067820df-8ebf-7572-8000-adc0b45a7fd6",
        "067820df-8ebf-75f9-8000-bb260a1543fd",
        "067820df-8ebf-762b-8000-05abdc8a967a",
        "067820df-b508-7ade-8000-52c5f7b28a67",
        "067820de-8b9f-7245-8000-f7f48a5f2915",
        "067820df-8ec0-7357-8000-c8cceb3fdd13",
        "067820df-8ec0-7895-8000-c8ca726d0e0d",
        "067820df-e871-7c97-8000-660781464cae",
        "067820df-e871-7d4f-8000-eb41dda3eba0",
        "067820df-e871-7d92-8000-aaa9a2b366d8",
        "067820e0-2fd1-7fb3-8000-0f2322706d61",
        "067820e0-129b-78ed-8000-95c4d6b4b054",
        "067820de-4065-78e6-8000-e38e31522aaa",
        "067820de-9414-7141-8000-a59b97fd3d6b",
        "067820db-4268-7123-8000-e6dc5dcb26bf",
        "067820db-4268-7166-8000-05639abd64bb",
        "067820da-6052-7524-8000-d5a1c4747d87",
        "067820e0-129b-7813-8000-ee043b6067ee",
        "067820e3-1cd4-7a90-8000-6632e6cf413a",
        "067e8e4a-9afc-7a42-8000-9e393b0a001b",
        "067820da-d75d-741f-8000-ef373eb6f5a8",
        "067820db-f48d-7fce-8000-1a60dabe06da",
        "067820db-987c-7dfe-8000-fe99b32e9874",
        "067820db-987c-7e31-8000-f271a567efa4",
        "067820db-987d-7230-8000-3f02d979a727",
        "067820db-1b70-7a6f-8000-37c925ae903f",
        "067820db-1b70-7b8c-8000-cecd7e954c4a",
        "067e8e39-b733-7f96-8000-eb40884a8362",
        "067e8e39-b734-714a-8000-a8e63b627cb3",
        "067e8e47-5277-7c78-8000-22e8964dd868",
        "067820dc-1f31-7401-8000-fb034e59765d",
        "067820dc-1f32-70b8-8000-51515843ee17",
        "067820dc-1f32-711c-8000-b92f85acb1b6",
        "067820e0-cbdc-76b0-8000-1b0364a93ff9",
        "067e8e3f-b2f7-7963-8000-784f9859e8af",
        "067e8e3f-b2f7-79b7-8000-068645d7bc76",
        "067e8e3f-ceb8-78b9-8000-de00af7f66c5",
        "067820dd-43cc-7ef6-8000-e999223ef9e1",
        "067e8e47-e621-78ef-8000-56c8f5614d1e",
        "067e8e3f-0a39-7884-8000-d5214cf84835",
        "067e8e3f-0a39-78c7-8000-1c3710c5f057",
        "067820dd-6288-7893-8000-adaad5d7a673",
        "067e8e3f-6622-71a7-8000-eba6c0519adc",
        "067820dc-7000-7f12-8000-118955ef7e0e",
        "067820dd-757f-73be-8000-6b05dad3690e",
        "067e8e39-765d-7bca-8000-c452c8fbcbaf",
        "067e8e3f-ceb9-7453-8000-a7c949bc8138",
        "067e8e3f-ceb9-7463-8000-c6eb02234f8c",
        "067820df-9ca4-7ebd-8000-bc42b32b0203",
        "068302c5-cc44-7950-8000-27f44c2acc22",
        "067820da-f61c-7c20-8000-4cb3946b70bd",
        "067820de-dd6d-7e22-8000-dee39be08d69",
        "067e8e3b-2e31-7f03-8000-01e9a041fb39",
        "067820de-3054-7c66-8000-418981e5dae6",
        "067820de-3054-7c98-8000-a0df7b78dc7c",
        "067820de-3055-76e2-8000-b923858f9841",
        "067820de-3055-7c74-8000-9946bf498f90",
        "067820de-3055-7ebf-8000-eb7ad45b31a1",
        "067820de-f4b6-7f4b-8000-e09690a4685d",
        "067e8e46-e4b9-75a2-8000-8d6fafad2ba3",
        "067820df-9ca4-7c83-8000-27d82fe88765",
        "067820de-d72b-7617-8000-14500e533875",
        "067820e1-3d59-71bc-8000-e2af643b404d",
        "067820dd-cdfb-7dbe-8000-08710594f167",
        "067820e1-1f55-7896-8000-9aefc308a032",
        "067820e1-4a9e-700d-8000-0d40ba2e2660",
        "067e8e3f-e975-7be5-8000-842720396b15",
        "067e8e39-d70d-7f26-8000-8b66fefbd7bd",
        "067e8e39-d70e-70c9-8000-86b42fbbaafe",
        "067820de-d72b-755e-8000-de0c80d5a478",
        "067e8e3a-0360-784a-8000-cddb3bbd612f",
        "067820db-f48d-7dc6-8000-8fbf404e123d",
        "067820de-2867-748e-8000-5cd9b1048e62",
        "067820da-f7a6-799c-8000-781c44d48a2f",
        "067e8e3a-3334-740a-8000-5da8c3c167e1",
        "067e8e3a-44b6-7e82-8000-6701e5300d88",
        "067820de-7c91-7548-8000-6c4c34b60ca7",
        "067820de-7c91-7600-8000-55860988390f",
        "067820de-7c91-7a32-8000-7cb9a50cb24d",
        "067820e1-9796-77ba-8000-5c053b5b83c6",
        "067e8e3b-2e32-7431-8000-90ba08129c24",
        "067e8e4b-468c-71db-8000-4c1bb6cac4a9",
        "067820dd-c670-7414-8000-dbe5b2bc4106",
        "067820e3-5347-7485-8000-378b2bdd94d5",
        "067e8e40-91da-7f3a-8000-2aac4c623d84",
        "067820e1-0fe7-7c9d-8000-6e2e5efaa765",
        "067e8e3b-b8a0-7275-8000-3989e5a824ac",
        "067e8e3a-f151-70b1-8000-95facb23cf09",
        "067e8e40-4e0a-7f92-8000-4b360c8489b7",
        "067820df-e871-7bde-8000-0f77c7928a59",
        "067820df-fc04-7934-8000-cfd4d250c5a9",
        "067820dc-2552-7cad-8000-01e42ab33fe2",
        "067820df-fc05-7597-8000-e36ffc2ccdc9",
        "067820df-fc05-75c9-8000-b13e4b2b1db9",
        "067820dc-eeda-7d85-8000-b5e8cabfb1e7",
        "067e8e3e-bbad-72cb-8000-2bdf3706d218",
        "067e8e42-07fb-7699-8000-c42105ed15dd",
        "067e8e42-07fb-76dc-8000-eac5eaaa2b61",
        "067820dc-eedb-7d0e-8000-a8fe772e8eb5",
        "067820dc-eedc-7400-8000-b053a0e4a357",
        "067e8e40-67fc-71ce-8000-b832ce18ee1b",
        "067e8e4a-5098-7505-8000-04386e5b8e22",
        "067e8e3b-8e80-7b88-8000-e73d5c5342f2",
        "067820df-bafe-760c-8000-f1b1f65a7b70",
        "067820e2-ac48-79b0-8000-587048f63bc3",
        "067820e2-5290-7f94-8000-552d1aec8533",
        "067e8e4a-8266-786e-8000-a08265f5cc45",
        "067e8e4a-8266-78b1-8000-32d83e48a8ab",
        "067e8e4a-92ac-7bd9-8000-c3c9711a55a6",
        "067820dd-4c3b-703e-8000-06fe05775b65",
        "067820dd-4c3b-717c-8000-075f38603121",
        "067e8e43-b2b7-7ac3-8000-4a2409b9e8e3",
        "067e8e43-b2b7-7ae5-8000-d7139e66297d",
        "067e8e43-f8da-72c6-8000-b2ef694409fd",
        "067820e0-971b-7f05-8000-87ea1f947418",
        "067820de-faa9-7ad4-8000-5c58e93163f3",
        "067820de-d72b-78c7-8000-8573b1217084",
        "067e8e4a-e901-7312-8000-2237960b332b",
        "067820dd-b567-7019-8000-51f849791c7c",
        "067820dd-b567-7664-8000-630dfefcd3c3",
        "067e8e3a-3334-742c-8000-5ef4514a80e4",
        "067820de-c2a9-738d-8000-e32a0c3f8c79",
        "067e8e3f-8ed7-77d9-8000-1e875f187302",
        "067e8e3b-c2cf-7227-8000-07159b2edaa8",
        "067e8e40-bba1-7bc1-8000-f0e39772f68c",
        "067820de-1d28-736e-8000-15c58d8c75c3",
        "067e8e3b-c2cf-73ba-8000-68cbc7302180",
        "067e8e3f-c7a0-7f0a-8000-679fc107e829",
        "067e8e38-e081-7e9a-8000-e639eee6c968",
        "067e8e4b-40c1-7615-8000-a9523533ad5e",
        "067820e0-e40c-7cbc-8000-65ffdbff8cb0",
        "067820dc-7486-7b69-8000-ad1459092b7b",
        "067e8e44-d131-761a-8000-6bea9e718181",
        "067820de-5216-7356-8000-ec7be4a79c18",
        "067820db-f48d-7e09-8000-334992e73964",
        "067e8e4a-3849-7d5a-8000-3acba0a0a72a",
        "067820db-f48e-723a-8000-8f470e27495e",
        "067e8e3a-44b6-7e3f-8000-0d2f18825ff3",
        "067e8e4b-8cca-719c-8000-e0587adae0fa",
        "067e8e3b-f501-77ca-8000-2dd510ab29e4",
        "067820e3-5d72-77bb-8000-25a9cfd66b16",
        "067820de-b11a-79c9-8000-75dbe356058f",
        "067aeced-c09d-71a9-8000-6b4f7e96f23d",
        "067e8e3b-f897-781c-8000-969e89b5afe1",
        "067e8e4b-ba40-7f88-8000-a7fd3f86a6d3",
        "067820e2-8326-704e-8000-0b2cbb8df31f",
        "068760b0-f3ac-7013-8000-5950168ea4fc",
        "067820dd-5fb4-7bf8-8000-ce44f03df398",
        "067820db-de31-7db4-8000-ee8e6df90947",
        "067820de-ceb3-72ce-8000-a2cfd1387430",
        "067820e2-8326-7091-8000-2cb0ce7231fa",
        "067820de-ceb3-7e78-8000-b9832f89230a",
        "067e8e41-3096-7638-8000-42461075dbf0",
        "067820de-c2a9-764e-8000-90e9c6cf338b",
        "067e8e41-3096-7af0-8000-af0eb28ab3dd",
    ]

    return [uuid.UUID(pid) for pid in product_id_strings]


def _load_products(product_ids: list[uuid.UUID]) -> dict[uuid.UUID, ProductRecord]:
    """Fetch product metadata up front so resolver calls stay pure API work."""

    if not product_ids:
        return {}

    with SessionLocal() as session:
        products = (
            session.query(Product)
            .options(selectinload(Product.set))
            .filter(Product.id.in_(product_ids))
            .all()
        )

    return {
        product.id: ProductRecord(
            id=product.id,
            clean_name=product.clean_name,
            number=product.number,
            set_code=product.set.code if getattr(product, "set", None) else None,
        )
        for product in products
    }


def main() -> None:
    product_ids = get_hardcoded_product_ids()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = Path(".tmp") / f"ebay_epid_results_{timestamp}.csv"

    asyncio.run(batch_resolve_epids(product_ids, str(output_file)))


if __name__ == "__main__":
    main()
