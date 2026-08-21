"""
Préstamo y devolución de ejemplares.

Se presta una **unidad**, no un modelo: "este taladro", no "un taladro". Es lo que
permite responder quién tiene cuál, y lo que hace que un kit sea un conjunto de
piezas concretas y no una idea.
"""
import math
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import MODALIDAD_A_CARGO, MODALIDAD_PLAZO
from app.models.unidad import Unidad
from app.repositories.inventory_log import InventoryLogRepository
from app.repositories.loan import LoanRepository
from app.repositories.unidad import UnidadRepository

ESTADO_DISPONIBLE = 1
ESTADO_EN_TERRENO = 2
ESTADO_EN_REPARACION = 3
ESTADO_ROBADO = 4

ESTADOS = {
    ESTADO_DISPONIBLE: "Disponible",
    ESTADO_EN_TERRENO: "En Terreno",
    ESTADO_EN_REPARACION: "En Reparación",
    ESTADO_ROBADO: "Robado",
}


def _codigo_de(unidad: Unidad) -> str:
    principal = next((c.codigo for c in unidad.codigos if c.es_principal), None)
    return principal or (unidad.codigos[0].codigo if unidad.codigos else f"#{unidad.id}")


def _limite_de(unidad: Unidad) -> int | None:
    """Días máximos de préstamo: override de la variante, herencia de la familia, o ninguno."""
    variante = unidad.variante
    if variante.dias_max_prestamo is not None:
        return variante.dias_max_prestamo
    return variante.producto.family.dias_max_prestamo


def _validar_plazo(piezas: list[Unidad], fecha_devolucion_prevista: datetime) -> None:
    """El límite del catálogo es el techo del acuerdo, no un dato paralelo.

    Un plazo por encima sólo puede terminar en un préstamo que nace vencido, y el
    bodeguero no tiene por qué descubrirlo al día siguiente en el panel.

    En un kit manda la pieza más restrictiva: el plazo es uno solo para todas, así
    que basta una con techo más bajo para que ese préstamo naciera vencido.
    """
    limites = [l for l in (_limite_de(p) for p in piezas) if l is not None]
    if not limites:
        return  # Sin techo en el catálogo no hay contra qué medir

    prevista = fecha_devolucion_prevista
    if prevista.tzinfo is None:
        prevista = prevista.replace(tzinfo=timezone.utc)
    dias_pedidos = math.ceil((prevista - datetime.now(timezone.utc)).total_seconds() / 86400)

    techo = min(limites)
    if dias_pedidos > techo:
        sujeto = "esta herramienta" if len(piezas) == 1 else "este kit"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El plazo máximo para {sujeto} es de {techo} días",
        )


async def _validar_prestable(unidad: Unidad) -> str:
    comportamiento = unidad.variante.producto.family.comportamiento
    if comportamiento != "prestable":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use el endpoint de consumibles para retirar consumibles",
        )
    return comportamiento


async def crear_prestamo(
    unidad_id: int,
    operario_id: int,
    session: AsyncSession,
    tenant_id: int,
    bodeguero_id: int,
    *,
    project_id: int | None = None,
    fecha_devolucion_prevista: datetime | None = None,
    modalidad: str = MODALIDAD_PLAZO,
):
    """Presta un ejemplar, o el kit completo si el ejemplar tiene piezas hijas.

    El kit se valida entero **antes** de crear ningún préstamo: entregar media caja
    de herramientas y descubrir a mitad de camino que falta una pieza deja al
    bodeguero con registros que no puede deshacer.

    La modalidad se propaga a todas las piezas: no existe la caja entregada a cargo
    con el disco de corte a plazo. El kit vuelve entero o no vuelve.
    """
    from app.models.user import User

    if modalidad == MODALIDAD_A_CARGO and fecha_devolucion_prevista is not None:
        # Juntas no significan nada, y aceptarlas dejaría un plazo que nadie va a
        # hacer cumplir: lo entregado a cargo está fuera del cálculo de vencidos.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una entrega a cargo no lleva fecha de devolución",
        )

    unidad_repo = UnidadRepository(session, tenant_id)
    loan_repo = LoanRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    unidad = await unidad_repo.get_con_hijas(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    await _validar_prestable(unidad)

    operario = await session.get(User, operario_id)
    if not operario or operario.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operario no encontrado")

    piezas = [unidad, *unidad.children]

    if fecha_devolucion_prevista is not None:
        _validar_plazo(piezas, fecha_devolucion_prevista)

    for pieza in piezas:
        if await loan_repo.get_active_by_unidad(pieza.id):
            detalle = (
                "La unidad ya tiene un préstamo activo"
                if len(piezas) == 1
                else f"No se puede prestar el kit: la unidad '{_codigo_de(pieza)}' ya está prestada"
            )
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detalle)
        if pieza.estado_id != ESTADO_DISPONIBLE:
            estado = ESTADOS.get(pieza.estado_id, "desconocido")
            detalle = (
                "La unidad no está disponible para préstamo"
                if len(piezas) == 1
                else f"No se puede prestar el kit: la unidad '{_codigo_de(pieza)}' está {estado}"
            )
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detalle)

    creados = []
    for pieza in piezas:
        prestamo = await loan_repo.create(
            unidad_id=pieza.id,
            user_id=operario_id,
            bodeguero_id=bodeguero_id,
            project_id=project_id,
            fecha_devolucion_prevista=fecha_devolucion_prevista,
            modalidad=modalidad,
        )
        await unidad_repo.update(pieza, estado_id=ESTADO_EN_TERRENO)
        await log_repo.create(
            variante_id=pieza.variante_id,
            unidad_id=pieza.id,
            user_id=bodeguero_id,
            operario_id=operario_id,
            project_id=project_id,
            tipo_movimiento="entrega",
            cantidad=1,
            observaciones=None if len(piezas) == 1 else f"Kit de {len(piezas)} piezas",
        )
        creados.append(prestamo)

    return creados


async def devolver_prestamo(
    loan_id: int,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    returning_user_id: int,
    *,
    observaciones: str | None = None,
    send_to_repair: bool = False,
):
    """Cierra el préstamo y devuelve el ejemplar a bodega.

    Si el ejemplar es kit padre, se cierran también los préstamos abiertos de sus
    piezas con el mismo estado final: el kit vuelve entero o no vuelve.
    """
    loan_repo = LoanRepository(session, tenant_id)
    unidad_repo = UnidadRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    loan = await loan_repo.get(loan_id)
    if not loan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Préstamo no encontrado")
    if loan.fecha_devolucion_real is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El préstamo ya fue devuelto"
        )

    # Puede devolverla otro: en una obra el que retiró se enfermó, renunció o está
    # en otro frente, y bloquear la devolución deja al bodeguero con la herramienta
    # en la mano y un préstamo que no puede cerrar — el terreno fértil para cerrarlo
    # "como si" lo devolviera el titular. La responsabilidad NO se mueve: el
    # préstamo sigue siendo de quien lo retiró y el movimiento anota quién la trajo.
    devuelve_otro = loan.user_id != returning_user_id
    if devuelve_otro:
        from app.models.user import User as _User

        portador = await session.get(_User, returning_user_id)
        if not portador or portador.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Operario no encontrado"
            )
        nota = f"Devuelta materialmente por {portador.nombre}"
        observaciones = f"{nota} · {observaciones}" if observaciones else nota

    estado_final = ESTADO_EN_REPARACION if send_to_repair else ESTADO_DISPONIBLE
    unidad = await unidad_repo.get_con_hijas(loan.unidad_id)
    piezas = [unidad, *unidad.children] if unidad else []

    cerrados = []
    for pieza in piezas:
        prestamo = (
            loan if pieza.id == loan.unidad_id else await loan_repo.get_active_by_unidad(pieza.id)
        )
        if not prestamo:
            continue

        await loan_repo.return_loan(prestamo)
        await unidad_repo.update(pieza, estado_id=estado_final)
        await log_repo.create(
            variante_id=pieza.variante_id,
            unidad_id=pieza.id,
            user_id=user_id,
            operario_id=prestamo.user_id,
            project_id=prestamo.project_id,
            tipo_movimiento="devolucion",
            cantidad=1,
            observaciones=observaciones,
        )
        if send_to_repair:
            # Movimiento aparte: una herramienta que vuelve rota es un hecho
            # distinto de que haya vuelto, y se consulta por separado.
            await log_repo.create(
                variante_id=pieza.variante_id,
                unidad_id=pieza.id,
                user_id=user_id,
                tipo_movimiento="reparacion",
                cantidad=1,
                observaciones="Enviado a reparación al momento de la devolución",
            )
        cerrados.append(prestamo)

    return cerrados


async def cerrar_reparacion(
    unidad_id: int,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    observaciones: str | None = None,
):
    """Devuelve a Disponible un ejemplar que estaba En Reparación."""
    unidad_repo = UnidadRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    unidad = await unidad_repo.get_con_relaciones(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    if unidad.estado_id != ESTADO_EN_REPARACION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La unidad no está en estado 'En Reparación'",
        )

    await unidad_repo.update(unidad, estado_id=ESTADO_DISPONIBLE)
    return await log_repo.create(
        variante_id=unidad.variante_id,
        unidad_id=unidad.id,
        user_id=user_id,
        tipo_movimiento="reparacion_completada",
        cantidad=1,
        observaciones=observaciones,
    )


async def reingresar_unidad(
    unidad_id: int,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    observaciones: str | None = None,
):
    """La herramienta dada por perdida apareció.

    No basta con devolver el estado: mientras el movimiento de pérdida siga solo,
    la obra carga un costo por algo que está de vuelta en la repisa. Por eso se
    registra un `reingreso` que apunta a la pérdida de origen y la neutraliza,
    igual que el reintegro de sobrante neutraliza parte de un despacho.

    La pérdida NO se borra: pasó, y borrarla dejaría un robo sin rastro. Lo que
    cambia es que dejó de ser definitiva.
    """
    from sqlalchemy import select

    from app.models.inventory_log import InventoryLog

    unidad_repo = UnidadRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    unidad = await unidad_repo.get_con_relaciones(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    if unidad.estado_id != ESTADO_ROBADO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La unidad no está reportada como perdida",
        )

    # La pérdida más reciente del ejemplar: de ahí salen la obra y el operario a
    # los que hay que devolverle el costo.
    perdida = (
        await session.execute(
            select(InventoryLog)
            .where(InventoryLog.tenant_id == tenant_id)
            .where(InventoryLog.unidad_id == unidad_id)
            .where(InventoryLog.tipo_movimiento == "perdida")
            .order_by(InventoryLog.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    await unidad_repo.update(unidad, estado_id=ESTADO_DISPONIBLE)
    return await log_repo.create(
        variante_id=unidad.variante_id,
        unidad_id=unidad.id,
        user_id=user_id,
        operario_id=perdida.operario_id if perdida else None,
        project_id=perdida.project_id if perdida else None,
        origen_log_id=perdida.id if perdida else None,
        tipo_movimiento="reingreso",
        cantidad=1,
        # El mismo costo con que se descontó: si se revalorizara al precio de hoy,
        # la resta no cuadraría con la suma y la obra quedaría con un saldo fantasma.
        costo_unitario=perdida.costo_unitario if perdida else unidad.variante.valor_reposicion,
        observaciones=observaciones,
    )


async def reportar_perdida_unidad(
    unidad_id: int,
    session: AsyncSession,
    tenant_id: int,
    user_id: int,
    *,
    project_id: int | None = None,
    observaciones: str | None = None,
):
    """Marca el ejemplar como Robado y cierra su préstamo si lo tenía.

    Una herramienta perdida no vuelve sola: dejar el préstamo abierto la mostraría
    para siempre como "en terreno", que es distinto de "no está".
    """
    unidad_repo = UnidadRepository(session, tenant_id)
    loan_repo = LoanRepository(session, tenant_id)
    log_repo = InventoryLogRepository(session, tenant_id)

    unidad = await unidad_repo.get_con_relaciones(unidad_id)
    if not unidad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unidad no encontrada")
    if unidad.estado_id == ESTADO_ROBADO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La unidad ya está reportada como robada"
        )

    prestamo = await loan_repo.get_active_by_unidad(unidad_id)
    if prestamo:
        await loan_repo.return_loan(prestamo)
        project_id = project_id or prestamo.project_id

    await unidad_repo.update(unidad, estado_id=ESTADO_ROBADO)
    return await log_repo.create(
        variante_id=unidad.variante_id,
        unidad_id=unidad.id,
        user_id=user_id,
        operario_id=prestamo.user_id if prestamo else None,
        project_id=project_id,
        tipo_movimiento="perdida",
        cantidad=1,
        # Se congela el valor de reposición, no el precio de compra: una herramienta
        # perdida cuesta lo que cuesta reemplazarla. Explícito porque el repositorio
        # estampa `precio_compra`, que en una herramienta es nulo — y sin esto el
        # movimiento quedaría sin costo y se revalorizaría solo al cambiar el precio
        # del producto, que es justo lo que el costo congelado existe para evitar.
        costo_unitario=unidad.variante.valor_reposicion,
        observaciones=observaciones,
    )
