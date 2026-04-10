from pydantic import BaseModel


class MenuItemResponse(BaseModel):
    id: int
    module_id: int
    parent_id: int | None
    label: str
    ruta: str
    icono: str | None
    orden: int
    children: list["MenuItemResponse"] = []

    model_config = {"from_attributes": True}


MenuItemResponse.model_rebuild()
